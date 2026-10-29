// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A standing trading mandate signed once by the asset owner.
///
/// This is the Argus allowance pattern, carried from Mantle to Injective and
/// pointed at a new counterparty: on Mantle the untrusted party was a keeper,
/// here it is an AI agent. The shape of the guarantee is identical — the agent
/// holds no discretion the owner did not sign for, and every bound is checked
/// on-chain by `ArgusMandate` before an order reaches Injective's exchange
/// module.
///
/// One signature authorizes many orders over the mandate's lifetime, inside
/// hard caps the owner set:
///   - `maxOrderNotional` — most notional (1e18 USD) in a SINGLE order.
///   - `maxTotalNotional` — most that can EVER be traded under this mandate.
///   - `priceBandBps`     — how far the order price may sit from the oracle.
///   - `maxOracleAge`     — refuse outright once the oracle goes stale.
///   - `cooldown`         — minimum seconds between orders (anti-grief).
/// The contract tracks cumulative notional and last-order time per
/// (owner, nonce). `nonce` identifies the standing mandate; it is NOT burned on
/// first use, and the owner can revoke it at any time.
///
/// `marketId`, `oracleBase` and `oracleQuote` are Injective's own identifiers,
/// held as `bytes32` so the EIP-712 encoding stays a fixed-size static type and
/// rendered to strings at call time.
///
/// Injective names feeds two different ways, and which one applies is a property
/// of the feed rather than of the oracle type — the live ChainlinkDataStreams
/// markets on testnet are keyed by 32-byte feed ids, while Stork and PriceFeed
/// feeds are keyed by plain symbols like "USDTUSD" or "GOLD". Rather than guess
/// from `oracleType`, the owner states the encoding in `idEncoding` and the
/// contract obeys it. Guessing here would mean a mandate that silently reads the
/// wrong feed, which is the one failure a price band cannot catch.
struct TradingMandate {
    address owner;
    address agent; // address(0) == any agent may relay
    bytes32 marketId; // Injective derivative market id (always hex)
    bytes32 oracleBase; // oracle base identifier
    bytes32 oracleQuote; // oracle quote identifier
    uint8 oracleType; // 2=PriceFeed 3=Coinbase 9=Pyth 11=Provider 12=Stork 13=ChainlinkDataStreams
    uint8 idEncoding; // see IdEncoding: how oracleBase/oracleQuote are rendered
    uint8 allowedSides; // bitmask, see Sides
    uint16 priceBandBps; // max |orderPrice - oraclePrice| / oraclePrice
    uint32 maxOracleAge; // seconds before the oracle is considered stale
    uint32 cooldown; // min seconds between orders
    uint256 maxOrderNotional; // per-order cap, 1e18 USD
    uint256 maxTotalNotional; // lifetime cap, 1e18 USD
    uint256 nonce; // standing-mandate id (not single-use)
    uint256 deadline;
}

/// @title Sides — shared bitmask constants for order direction.
/// @notice Mirror these in the agent so both layers agree.
library Sides {
    uint8 internal constant BUY = 1;
    uint8 internal constant SELL = 2;
}

/// @title IdEncoding — how an oracle identifier is rendered for the precompile.
library IdEncoding {
    /// @notice `0x`-prefixed 64-char hex, e.g. a ChainlinkDataStreams feed id.
    uint8 internal constant HEX = 0;
    /// @notice ASCII symbol with trailing zero bytes trimmed, e.g. "USDTUSD".
    uint8 internal constant SYMBOL = 1;
}

library MandateLib {
    error BadIdEncoding();
    error EmptySymbol();

    // Keep field order IDENTICAL to the TradingMandate struct.
    bytes32 internal constant MANDATE_TYPEHASH = keccak256(
        "TradingMandate(address owner,address agent,bytes32 marketId,bytes32 oracleBase,bytes32 oracleQuote,uint8 oracleType,uint8 idEncoding,uint8 allowedSides,uint16 priceBandBps,uint32 maxOracleAge,uint32 cooldown,uint256 maxOrderNotional,uint256 maxTotalNotional,uint256 nonce,uint256 deadline)"
    );

    function hash(TradingMandate memory m) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                MANDATE_TYPEHASH,
                m.owner,
                m.agent,
                m.marketId,
                m.oracleBase,
                m.oracleQuote,
                m.oracleType,
                m.idEncoding,
                m.allowedSides,
                m.priceBandBps,
                m.maxOracleAge,
                m.cooldown,
                m.maxOrderNotional,
                m.maxTotalNotional,
                m.nonce,
                m.deadline
            )
        );
    }

    /// @notice Injective's default subaccount for an EVM address: the 20-byte
    ///         address left-aligned in 32 bytes, trailing 12 bytes zero.
    function defaultSubaccount(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)) << 96);
    }

    bytes16 private constant HEX = "0123456789abcdef";

    /// @notice Render a bytes32 as the `0x`-prefixed 64-char lowercase hex string
    ///         that the Injective precompiles take for market, subaccount and
    ///         oracle identifiers.
    function toHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; ++i) {
            uint8 b = uint8(value[i]);
            out[2 + i * 2] = HEX[b >> 4];
            out[3 + i * 2] = HEX[b & 0x0f];
        }
        return string(out);
    }

    /// @notice Render a bytes32 as an ASCII symbol, dropping trailing zero bytes.
    /// @dev Reverts on an empty symbol: an oracle lookup keyed by "" would read
    ///      the wrong feed or none at all, and both are worse than refusing.
    function toSymbol(bytes32 value) internal pure returns (string memory) {
        uint256 len = 32;
        while (len > 0 && value[len - 1] == 0) {
            --len;
        }
        if (len == 0) revert EmptySymbol();
        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; ++i) {
            out[i] = value[i];
        }
        return string(out);
    }

    /// @notice Render an oracle identifier the way the mandate says to.
    function renderId(bytes32 value, uint8 encoding) internal pure returns (string memory) {
        if (encoding == IdEncoding.HEX) return toHexString(value);
        if (encoding == IdEncoding.SYMBOL) return toSymbol(value);
        revert BadIdEncoding();
    }
}
