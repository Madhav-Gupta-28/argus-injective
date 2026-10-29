// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {TradingMandate, MandateLib, Sides, IdEncoding} from "./MandateLib.sol";
import {IOracleModule} from "./injective/Oracle.sol";
import {IExchangeModule} from "./injective/Exchange.sol";
import {ExchangeTypes} from "./injective/ExchangeTypes.sol";
import {Bech32} from "./Bech32.sol";

/// @title ArgusMandate
/// @notice An on-chain mandate for AI agents trading on Injective. Non-custodial.
///
///         The agent has zero discretion. It proposes an order; this contract
///         independently re-derives the reference price from Injective's oracle
///         precompile and refuses unless every bound the owner signed still
///         holds. Only then does the order reach the exchange precompile.
///
///         Concretely, a stolen agent key, a hallucinated instruction or a
///         prompt-injected trade cannot:
///           - trade a market the owner did not name,
///           - trade a side the owner did not allow,
///           - exceed the per-order or lifetime notional caps,
///           - price an order outside the oracle band,
///           - or execute at all while the oracle is stale.
///
///         Every refusal is a typed revert, so a caller can prove the refusal
///         with `eth_call` alone — no key, no indexer, no server.
contract ArgusMandate is EIP712, Ownable, Pausable, ReentrancyGuard {
    using MandateLib for TradingMandate;

    IOracleModule public constant ORACLE = IOracleModule(0x0000000000000000000000000000000000000067);
    IExchangeModule public constant EXCHANGE = IExchangeModule(0x0000000000000000000000000000000000000065);

    /// @notice Upper sanity bound on the band an owner may sign. A mandate whose
    ///         band is wider than this is refused outright: past a certain width
    ///         the band stops being a control and the agent regains discretion.
    ///         Owner-tunable; 50% is a gross-misconfiguration guard, not a
    ///         normal setting.
    uint16 public maxAllowedBandBps = 5_000;

    /// @notice Hard ceiling on `maxOracleAge`. Signing a mandate that tolerates a
    ///         week-old price would defeat the staleness check, so the contract
    ///         refuses to honour one.
    uint32 public maxAllowedOracleAge = 1 hours;

    /// @notice Per-mandate state. A mandate is identified by (owner, nonce) and is
    ///         a STANDING authorization: it can place many orders until the
    ///         lifetime cap is spent, the deadline passes, or the owner revokes.
    struct Allowance {
        uint256 spent; // cumulative notional traded, 1e18 USD
        uint64 lastOrderAt; // timestamp of the last accepted order (0 = never)
        uint32 orders; // accepted order count
        bool revoked; // owner cancelled it
    }

    mapping(address => mapping(uint256 => Allowance)) public allowances;

    /// @notice Emergency-stop role. Can pause/unpause all orders and nothing else.
    ///         Pausing only blocks new orders — this contract never holds user
    ///         funds, so a pause always fails closed and is safe by construction.
    address public guardian;

    event OrderPlaced(
        address indexed owner,
        address indexed agent,
        bytes32 indexed mandateHash,
        uint8 side,
        uint256 quantity,
        uint256 price,
        uint256 oraclePrice,
        uint256 notional,
        string orderHash
    );
    event MandateRevoked(address indexed owner, uint256 indexed nonce);
    event GuardianSet(address indexed guardian);
    event MaxAllowedBandBpsSet(uint16 bps);
    event MaxAllowedOracleAgeSet(uint32 age);

    error NotAgent();
    error NotGuardian();
    error BadSignature();
    error MandateExpired();
    error MandateRevokedError();
    error CooldownActive();
    error NotionalCapExceeded();
    error LifetimeCapExhausted();
    error SideNotAllowed();
    error BandTooWide();
    error OracleAgeTooLong();
    error StaleOracle(uint256 age, uint256 maxAge);
    error OutsideBand(uint256 deviationBps, uint256 maxBps);
    error BadOraclePrice();
    error ZeroQuantity();

    constructor(address _guardian) EIP712("ArgusMandate", "1") Ownable(msg.sender) {
        guardian = _guardian == address(0) ? msg.sender : _guardian;
        emit GuardianSet(guardian);
    }

    // ------------------------------------------------------------------ admin

    function setGuardian(address g) external onlyOwner {
        guardian = g;
        emit GuardianSet(g);
    }

    function setMaxAllowedBandBps(uint16 bps) external onlyOwner {
        maxAllowedBandBps = bps;
        emit MaxAllowedBandBpsSet(bps);
    }

    function setMaxAllowedOracleAge(uint32 age) external onlyOwner {
        maxAllowedOracleAge = age;
        emit MaxAllowedOracleAgeSet(age);
    }

    function pause() external {
        if (msg.sender != guardian && msg.sender != owner()) revert NotGuardian();
        _pause();
    }

    function unpause() external {
        if (msg.sender != guardian && msg.sender != owner()) revert NotGuardian();
        _unpause();
    }

    /// @notice Revoke a standing mandate immediately. Called by the owner — no
    ///         signature needed, msg.sender IS the owner. After this no further
    ///         order under this (owner, nonce) can execute. Cheap and final:
    ///         this is what backs the "revocable anytime" promise.
    function revoke(uint256 nonce) external {
        allowances[msg.sender][nonce].revoked = true;
        emit MandateRevoked(msg.sender, nonce);
    }

    // ------------------------------------------------------------------ views

    /// @notice The oracle's current reference price (1e18) and its age in seconds.
    /// @dev Reverts `BadOraclePrice` when the precompile has no price for the
    ///      triple, which is itself a safe outcome: no price, no trade.
    function referencePrice(TradingMandate calldata m) public view returns (uint256 price1e18, uint256 age) {
        return _reference(m);
    }

    /// @notice This contract's Injective account address. Orders carry it as the
    ///         fee recipient, derived here rather than supplied by a caller, so a
    ///         relayer cannot redirect trading fees to itself.
    function injAddress() public view returns (string memory) {
        return Bech32.encodeInj(address(this));
    }

    function mandateHash(TradingMandate calldata m) external view returns (bytes32) {
        return _hashTypedDataV4(m.hash());
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /// @notice Dry-run every check without sending a transaction.
    /// @return ok    true when the order would be accepted right now.
    /// @return reason empty when ok, else the name of the first failing check.
    /// @dev This is the agent's conscience: it asks before it acts, and a
    ///      reviewer can reproduce any refusal with `eth_call` alone.
    function preflight(TradingMandate calldata m, bytes calldata signature, uint8 side, uint256 quantity1e18, uint256 price1e18)
        external
        view
        returns (bool ok, string memory reason)
    {
        if (paused()) return (false, "Paused");
        if (m.agent != address(0) && m.agent != msg.sender) return (false, "NotAgent");
        if (ECDSA.recover(_hashTypedDataV4(m.hash()), signature) != m.owner) return (false, "BadSignature");
        if (block.timestamp > m.deadline) return (false, "MandateExpired");
        if (m.priceBandBps > maxAllowedBandBps) return (false, "BandTooWide");
        if (m.maxOracleAge > maxAllowedOracleAge) return (false, "OracleAgeTooLong");
        if (side != Sides.BUY && side != Sides.SELL) return (false, "SideNotAllowed");
        if (side & m.allowedSides == 0) return (false, "SideNotAllowed");
        if (quantity1e18 == 0) return (false, "ZeroQuantity");

        Allowance storage a = allowances[m.owner][m.nonce];
        if (a.revoked) return (false, "MandateRevoked");
        if (a.lastOrderAt != 0 && block.timestamp < a.lastOrderAt + m.cooldown) return (false, "CooldownActive");

        uint256 notional = Math_mulDiv1e18(quantity1e18, price1e18);
        if (notional > m.maxOrderNotional) return (false, "NotionalCapExceeded");
        if (a.spent + notional > m.maxTotalNotional) return (false, "LifetimeCapExhausted");

        (bool got, uint256 ref1e18, uint256 age) = _tryReference(m);
        if (!got || ref1e18 == 0) return (false, "BadOraclePrice");
        if (age > m.maxOracleAge) return (false, "StaleOracle");
        if (_deviationBps(price1e18, ref1e18) > m.priceBandBps) return (false, "OutsideBand");

        return (true, "");
    }

    // ------------------------------------------------------------------ execute

    /// @notice Relay an agent-proposed market order, bounded by the owner's mandate.
    /// @dev The agent supplies the order; the contract supplies the authority. Every
    ///      number the agent provides is re-checked here against the owner's signed
    ///      bounds and against the oracle precompile, which the agent cannot
    ///      influence. State is written before the external call
    ///      (checks-effects-interactions).
    /// @param m          the owner-signed mandate
    /// @param signature  the owner's EIP-712 signature over `m`
    /// @param side       Sides.BUY or Sides.SELL
    /// @param quantity1e18 order quantity, 1e18-scaled (Injective API format)
    /// @param price1e18  worst acceptable price, 1e18-scaled (Injective API format)
    /// @param margin1e18 margin to post, 1e18-scaled (Injective API format)
    function placeOrder(
        TradingMandate calldata m,
        bytes calldata signature,
        uint8 side,
        uint256 quantity1e18,
        uint256 price1e18,
        uint256 margin1e18
    ) external nonReentrant whenNotPaused returns (string memory orderHash) {
        // 1) Authority. Who may relay, and did the owner really sign this?
        if (m.agent != address(0) && m.agent != msg.sender) revert NotAgent();
        if (ECDSA.recover(_hashTypedDataV4(m.hash()), signature) != m.owner) revert BadSignature();
        if (block.timestamp > m.deadline) revert MandateExpired();

        // 2) Refuse a mandate whose own controls are too loose to be controls.
        if (m.priceBandBps > maxAllowedBandBps) revert BandTooWide();
        if (m.maxOracleAge > maxAllowedOracleAge) revert OracleAgeTooLong();

        // 3) Shape of the order against what the owner allowed.
        if (side != Sides.BUY && side != Sides.SELL) revert SideNotAllowed();
        if (side & m.allowedSides == 0) revert SideNotAllowed();
        if (quantity1e18 == 0) revert ZeroQuantity();

        Allowance storage a = allowances[m.owner][m.nonce];
        if (a.revoked) revert MandateRevokedError();
        if (a.lastOrderAt != 0 && block.timestamp < a.lastOrderAt + m.cooldown) revert CooldownActive();

        uint256 notional = Math_mulDiv1e18(quantity1e18, price1e18);
        if (notional > m.maxOrderNotional) revert NotionalCapExceeded();
        if (a.spent + notional > m.maxTotalNotional) revert LifetimeCapExhausted();

        // 4) Re-derive the reference price ourselves. The agent cannot reach this.
        (uint256 ref1e18, uint256 age) = _reference(m);
        if (age > m.maxOracleAge) revert StaleOracle(age, m.maxOracleAge);

        uint256 devBps = _deviationBps(price1e18, ref1e18);
        if (devBps > m.priceBandBps) revert OutsideBand(devBps, m.priceBandBps);

        // 5) Effects before interaction.
        a.spent += notional;
        a.lastOrderAt = uint64(block.timestamp);
        a.orders += 1;

        // 6) Only now does the order reach Injective's exchange module.
        orderHash = _send(m, side, quantity1e18, price1e18, margin1e18);

        emit OrderPlaced(
            m.owner, msg.sender, _hashTypedDataV4(m.hash()), side, quantity1e18, price1e18, ref1e18, notional, orderHash
        );
    }

    // ------------------------------------------------------------------ internal

    function _send(TradingMandate calldata m, uint8 side, uint256 quantity1e18, uint256 price1e18, uint256 margin1e18)
        internal
        returns (string memory)
    {
        IExchangeModule.DerivativeOrder memory order = IExchangeModule.DerivativeOrder({
            marketID: MandateLib.toHexString(m.marketId),
            subaccountID: MandateLib.toHexString(MandateLib.defaultSubaccount(address(this))),
            feeRecipient: injAddress(),
            price: ExchangeTypes.UFixed256x18.wrap(price1e18),
            quantity: ExchangeTypes.UFixed256x18.wrap(quantity1e18),
            cid: "",
            orderType: side == Sides.BUY ? "buy" : "sell",
            margin: ExchangeTypes.UFixed256x18.wrap(margin1e18),
            triggerPrice: ExchangeTypes.UFixed256x18.wrap(0)
        });
        IExchangeModule.CreateDerivativeMarketOrderResponse memory res =
            EXCHANGE.createDerivativeMarketOrder(address(this), order);
        return res.orderHash;
    }

    function _reference(TradingMandate calldata m) internal view returns (uint256 price1e18, uint256 age) {
        IOracleModule.PricePairState memory s =
            ORACLE.oraclePricePairState(
            m.oracleType, MandateLib.renderId(m.oracleBase, m.idEncoding), MandateLib.renderId(m.oracleQuote, m.idEncoding)
        );
        if (s.pairPrice == 0) revert BadOraclePrice();
        price1e18 = s.pairPrice;
        uint256 ts = uint256(s.baseTimestamp) < uint256(s.quoteTimestamp) ? uint256(s.baseTimestamp) : uint256(s.quoteTimestamp);
        // A timestamp in the future is treated as "now", never as negative age.
        age = block.timestamp > ts ? block.timestamp - ts : 0;
    }

    /// @dev Non-reverting variant used by `preflight`, so a dry run can report
    ///      "no price" as a reason string instead of bubbling a revert.
    function _tryReference(TradingMandate calldata m) internal view returns (bool ok, uint256 price1e18, uint256 age) {
        try this.referencePrice(m) returns (uint256 p, uint256 a) {
            return (true, p, a);
        } catch {
            return (false, 0, 0);
        }
    }

    function _deviationBps(uint256 price1e18, uint256 ref1e18) internal pure returns (uint256) {
        if (ref1e18 == 0) revert BadOraclePrice();
        uint256 diff = price1e18 > ref1e18 ? price1e18 - ref1e18 : ref1e18 - price1e18;
        return (diff * 10_000) / ref1e18;
    }

    /// @dev `quantity * price / 1e18`, both 1e18-scaled, giving 1e18 USD notional.
    function Math_mulDiv1e18(uint256 x, uint256 y) internal pure returns (uint256) {
        return (x * y) / 1e18;
    }

}
