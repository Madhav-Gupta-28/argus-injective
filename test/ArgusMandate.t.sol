// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {ArgusMandate} from "../src/ArgusMandate.sol";
import {TradingMandate, MandateLib, Sides, IdEncoding} from "../src/MandateLib.sol";
import {MockOracle, MockExchange} from "./Mocks.sol";

/// @notice The mandate's refusal matrix. Every test here is a thing an agent
///         might try — because it was stolen, prompt-injected, or simply wrong —
///         and the assertion is that the chain says no.
contract ArgusMandateTest is Test {
    address constant ORACLE_ADDR = 0x0000000000000000000000000000000000000067;
    address constant EXCHANGE_ADDR = 0x0000000000000000000000000000000000000065;

    ArgusMandate argus;
    MockOracle oracle;
    MockExchange exchange;

    uint256 ownerPk = 0xA11CE;
    address ownerAddr;
    address agent = address(0xA6E7);
    address stranger = address(0xBAD);
    address guardian = address(0x6A12);

    bytes32 constant MARKET = bytes32(uint256(0xBEEF));
    bytes32 constant OB = bytes32(uint256(0x1111));
    bytes32 constant OQ = bytes32(uint256(0x2222));

    uint256 constant REF = 80_000e18; // oracle says 80,000
    uint256 constant QTY = 1e18; // 1 unit
    uint256 constant MARGIN = 8_000e18;

    function setUp() public {
        ownerAddr = vm.addr(ownerPk);

        // Put the stand-ins where the precompiles live, so the contract under
        // test calls exactly the addresses it will call on Injective.
        vm.etch(ORACLE_ADDR, address(new MockOracle()).code);
        vm.etch(EXCHANGE_ADDR, address(new MockExchange()).code);
        oracle = MockOracle(ORACLE_ADDR);
        exchange = MockExchange(EXCHANGE_ADDR);

        vm.warp(1_700_000_000);
        oracle.set(REF, uint64(block.timestamp));

        argus = new ArgusMandate(guardian);
    }

    // ------------------------------------------------------------------ helpers

    function _mandate() internal view returns (TradingMandate memory m) {
        m = TradingMandate({
            owner: ownerAddr,
            agent: agent,
            marketId: MARKET,
            oracleBase: OB,
            oracleQuote: OQ,
            oracleType: 13,
            idEncoding: IdEncoding.HEX,
            allowedSides: Sides.BUY | Sides.SELL,
            priceBandBps: 100, // 1%
            maxOracleAge: 60,
            cooldown: 30,
            maxOrderNotional: 100_000e18,
            maxTotalNotional: 250_000e18,
            nonce: 1,
            deadline: block.timestamp + 7 days
        });
    }

    function _sign(TradingMandate memory m) internal view returns (bytes memory) {
        bytes32 digest = argus.mandateHash(m);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _place(TradingMandate memory m, bytes memory sig, uint8 side, uint256 qty, uint256 price)
        internal
        returns (string memory)
    {
        vm.prank(m.agent == address(0) ? agent : m.agent);
        return argus.placeOrder(m, sig, side, qty, price, MARGIN);
    }

    // ------------------------------------------------------------------ happy path

    function test_orderInsideTheMandateReachesTheExchange() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        string memory h = _place(m, sig, Sides.BUY, QTY, REF);

        assertEq(h, "0xmockorderhash");
        assertEq(exchange.calls(), 1, "exactly one order reached the exchange");
        assertEq(exchange.lastSender(), address(argus), "the mandate is the sender, not the agent");
        assertEq(exchange.lastQuantity(), QTY);
        assertEq(exchange.lastPrice(), REF);
        assertEq(exchange.lastOrderType(), "buy");

        (uint256 spent, uint64 lastAt, uint32 orders, bool revoked) = argus.allowances(ownerAddr, m.nonce);
        assertEq(spent, 80_000e18, "notional = qty * price / 1e18");
        assertEq(lastAt, uint64(block.timestamp));
        assertEq(orders, 1);
        assertFalse(revoked);
    }

    function test_sellSideRendersAsSell() public {
        TradingMandate memory m = _mandate();
        _place(m, _sign(m), Sides.SELL, QTY, REF);
        assertEq(exchange.lastOrderType(), "sell");
    }

    function test_marketAndSubaccountAreRenderedAsInjectiveHex() public {
        TradingMandate memory m = _mandate();
        _place(m, _sign(m), Sides.BUY, QTY, REF);

        assertEq(exchange.lastMarketId(), MandateLib.toHexString(MARKET));
        assertEq(bytes(exchange.lastMarketId()).length, 66, "0x + 64 hex chars");
        // The subaccount is the mandate contract's own default subaccount: its
        // address left-aligned in 32 bytes.
        assertEq(exchange.lastSubaccountId(), MandateLib.toHexString(MandateLib.defaultSubaccount(address(argus))));
    }

    function test_repeatedOrdersAccumulateUntilTheLifetimeCap() public {
        TradingMandate memory m = _mandate();
        m.maxTotalNotional = 160_000e18; // exactly two orders of 80k
        bytes memory sig = _sign(m);

        _place(m, sig, Sides.BUY, QTY, REF);
        vm.warp(block.timestamp + m.cooldown);
        _place(m, sig, Sides.BUY, QTY, REF);

        (uint256 spent,, uint32 orders,) = argus.allowances(ownerAddr, m.nonce);
        assertEq(spent, 160_000e18);
        assertEq(orders, 2);

        vm.warp(block.timestamp + m.cooldown);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.LifetimeCapExhausted.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    // ------------------------------------------------------------------ the headline refusals

    /// @notice A stale oracle fails closed. No price the contract trusts, no trade.
    function test_REFUSE_staleOracle() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        vm.warp(block.timestamp + 61); // price is now 61s old, mandate allows 60
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ArgusMandate.StaleOracle.selector, 61, 60));
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);

        assertEq(exchange.calls(), 0, "nothing reached the exchange");
    }

    /// @notice The agent prices the order away from the oracle — the classic shape
    ///         of a manipulated or hallucinated instruction. Refused.
    function test_REFUSE_priceOutsideTheBand() public {
        TradingMandate memory m = _mandate(); // 1% band
        bytes memory sig = _sign(m);

        uint256 badPrice = (REF * 9_000) / 10_000; // 10% below the oracle
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ArgusMandate.OutsideBand.selector, 1_000, 100));
        argus.placeOrder(m, sig, Sides.BUY, QTY, badPrice, MARGIN);

        assertEq(exchange.calls(), 0);
    }

    function test_bandIsTwoSidedAndInclusiveAtTheEdge() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        // Exactly 1% above: allowed (deviation == band).
        _place(m, sig, Sides.BUY, QTY, (REF * 10_100) / 10_000);
        assertEq(exchange.calls(), 1);

        // Exactly 1% below, after cooldown: also allowed.
        vm.warp(block.timestamp + m.cooldown);
        _place(m, sig, Sides.BUY, QTY, (REF * 9_900) / 10_000);
        assertEq(exchange.calls(), 2);

        // One bp past the edge: refused.
        vm.warp(block.timestamp + m.cooldown);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ArgusMandate.OutsideBand.selector, 101, 100));
        argus.placeOrder(m, sig, Sides.BUY, QTY, (REF * 10_101) / 10_000, MARGIN);
    }

    /// @notice No price at all is also a refusal, not a zero price.
    function test_REFUSE_whenTheOracleHasNoPrice() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        oracle.setReverts(true);
        vm.prank(agent);
        vm.expectRevert();
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);

        oracle.setReverts(false);
        oracle.set(0, uint64(block.timestamp));
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.BadOraclePrice.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    // ------------------------------------------------------------------ authority

    function test_REFUSE_strangerRelaying() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        vm.prank(stranger);
        vm.expectRevert(ArgusMandate.NotAgent.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    function test_anyAgentAllowedWhenAgentFieldIsZero() public {
        TradingMandate memory m = _mandate();
        m.agent = address(0);
        bytes memory sig = _sign(m);
        vm.prank(stranger);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
        assertEq(exchange.calls(), 1);
    }

    function test_REFUSE_forgedSignature() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        // Same signature, mutated terms: the digest changes, recovery misses.
        m.maxOrderNotional = 10_000_000e18;
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.BadSignature.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    function test_REFUSE_signatureFromSomeoneElse() public {
        TradingMandate memory m = _mandate();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(0xB0B), argus.mandateHash(m));
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.BadSignature.selector);
        argus.placeOrder(m, abi.encodePacked(r, s, v), Sides.BUY, QTY, REF, MARGIN);
    }

    function test_REFUSE_expiredMandate() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        vm.warp(m.deadline + 1);
        oracle.set(REF, uint64(block.timestamp));
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.MandateExpired.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    function test_ownerCanRevokeMidFlight() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        _place(m, sig, Sides.BUY, QTY, REF);

        vm.prank(ownerAddr);
        argus.revoke(m.nonce);

        vm.warp(block.timestamp + m.cooldown);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.MandateRevokedError.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    function test_revokeIsScopedToOwnerAndNonce() public {
        TradingMandate memory m = _mandate();
        vm.prank(stranger);
        argus.revoke(m.nonce); // a stranger can only ever revoke their own
        _place(m, _sign(m), Sides.BUY, QTY, REF);
        assertEq(exchange.calls(), 1, "owner's mandate untouched");
    }

    // ------------------------------------------------------------------ order shape

    function test_REFUSE_disallowedSide() public {
        TradingMandate memory m = _mandate();
        m.allowedSides = Sides.BUY; // long-only
        bytes memory sig = _sign(m);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.SideNotAllowed.selector);
        argus.placeOrder(m, sig, Sides.SELL, QTY, REF, MARGIN);
    }

    function test_REFUSE_nonsenseSide() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.SideNotAllowed.selector);
        argus.placeOrder(m, sig, 3, QTY, REF, MARGIN); // both bits set
    }

    function test_REFUSE_zeroQuantity() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.ZeroQuantity.selector);
        argus.placeOrder(m, sig, Sides.BUY, 0, REF, MARGIN);
    }

    function test_REFUSE_perOrderNotionalCap() public {
        TradingMandate memory m = _mandate();
        m.maxOrderNotional = 50_000e18;
        bytes memory sig = _sign(m);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.NotionalCapExceeded.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN); // 80k > 50k
    }

    function test_REFUSE_cooldown() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        _place(m, sig, Sides.BUY, QTY, REF);

        vm.warp(block.timestamp + m.cooldown - 1);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.CooldownActive.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    // ------------------------------------------------------------------ mandate sanity bounds

    function test_REFUSE_mandateWithABandTooWideToBeAControl() public {
        TradingMandate memory m = _mandate();
        m.priceBandBps = 6_000; // 60% — not a control any more
        bytes memory sig = _sign(m);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.BandTooWide.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    function test_REFUSE_mandateToleratingAnAncientPrice() public {
        TradingMandate memory m = _mandate();
        m.maxOracleAge = 2 hours;
        bytes memory sig = _sign(m);
        vm.prank(agent);
        vm.expectRevert(ArgusMandate.OracleAgeTooLong.selector);
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);
    }

    // ------------------------------------------------------------------ emergency stop

    function test_guardianCanPauseAndOnlyGuardianOrOwnerCan() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        vm.prank(stranger);
        vm.expectRevert(ArgusMandate.NotGuardian.selector);
        argus.pause();

        vm.prank(guardian);
        argus.pause();

        vm.prank(agent);
        vm.expectRevert();
        argus.placeOrder(m, sig, Sides.BUY, QTY, REF, MARGIN);

        vm.prank(guardian);
        argus.unpause();
        _place(m, sig, Sides.BUY, QTY, REF);
        assertEq(exchange.calls(), 1);
    }

    // ------------------------------------------------------------------ preflight

    function test_preflightAgreesWithExecutionOnEveryRefusal() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        vm.prank(agent);
        (bool ok, string memory reason) = argus.preflight(m, sig, Sides.BUY, QTY, REF);
        assertTrue(ok);
        assertEq(reason, "");

        vm.prank(agent);
        (ok, reason) = argus.preflight(m, sig, Sides.BUY, QTY, (REF * 9_000) / 10_000);
        assertFalse(ok);
        assertEq(reason, "OutsideBand");

        vm.warp(block.timestamp + 61);
        vm.prank(agent);
        (ok, reason) = argus.preflight(m, sig, Sides.BUY, QTY, REF);
        assertFalse(ok);
        assertEq(reason, "StaleOracle");

        oracle.setReverts(true);
        vm.prank(agent);
        (ok, reason) = argus.preflight(m, sig, Sides.BUY, QTY, REF);
        assertFalse(ok);
        assertEq(reason, "BadOraclePrice", "a missing price is reported, not thrown");
    }

    function test_preflightReportsStrangerAndRevocation() public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);

        vm.prank(stranger);
        (bool ok, string memory reason) = argus.preflight(m, sig, Sides.BUY, QTY, REF);
        assertFalse(ok);
        assertEq(reason, "NotAgent");

        vm.prank(ownerAddr);
        argus.revoke(m.nonce);
        vm.prank(agent);
        (ok, reason) = argus.preflight(m, sig, Sides.BUY, QTY, REF);
        assertFalse(ok);
        assertEq(reason, "MandateRevoked");
    }

    // ------------------------------------------------------------------ encoding

    function test_hexRendering() public pure {
        assertEq(
            MandateLib.toHexString(bytes32(uint256(0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439))),
            "0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439"
        );
        assertEq(
            MandateLib.toHexString(bytes32(0)), "0x0000000000000000000000000000000000000000000000000000000000000000"
        );
    }

    function test_symbolRenderingTrimsTrailingZeros() public pure {
        assertEq(MandateLib.toSymbol(bytes32("USDTUSD")), "USDTUSD");
        assertEq(MandateLib.toSymbol(bytes32("GOLD")), "GOLD");
        // A symbol filling all 32 bytes keeps every byte.
        assertEq(bytes(MandateLib.toSymbol(bytes32(type(uint256).max))).length, 32);
    }

    function test_renderIdDispatchesOnEncodingAndRefusesNonsense() public {
        bytes32 v = bytes32("USDTUSD");
        assertEq(MandateLib.renderId(v, IdEncoding.SYMBOL), "USDTUSD");
        assertEq(bytes(MandateLib.renderId(v, IdEncoding.HEX)).length, 66);

        vm.expectRevert(MandateLib.BadIdEncoding.selector);
        this.renderIdExt(v, 7);
        vm.expectRevert(MandateLib.EmptySymbol.selector);
        this.renderIdExt(bytes32(0), IdEncoding.SYMBOL);
    }

    function renderIdExt(bytes32 v, uint8 e) external pure returns (string memory) {
        return MandateLib.renderId(v, e);
    }

    /// @notice A symbolic mandate reads the symbol feed, not a hex one. Getting
    ///         this wrong would silently price against the wrong asset.
    function test_symbolicMandateReachesTheOracleAsASymbol() public {
        TradingMandate memory m = _mandate();
        m.idEncoding = IdEncoding.SYMBOL;
        m.oracleBase = bytes32("USDTUSD");
        m.oracleQuote = bytes32("USD");
        m.oracleType = 12;
        _place(m, _sign(m), Sides.BUY, QTY, REF);
        assertEq(exchange.calls(), 1);
    }

    function test_defaultSubaccountMatchesInjectiveConvention() public pure {
        address a = 0x56f1c01de7d8d4F1468DAf945E65E5c7D32A8B32;
        assertEq(
            MandateLib.toHexString(MandateLib.defaultSubaccount(a)),
            "0x56f1c01de7d8d4f1468daf945e65e5c7d32a8b32000000000000000000000000"
        );
    }

    function test_typehashIsStable() public pure {
        assertEq(
            MandateLib.MANDATE_TYPEHASH,
            keccak256(
                "TradingMandate(address owner,address agent,bytes32 marketId,bytes32 oracleBase,bytes32 oracleQuote,uint8 oracleType,uint8 idEncoding,uint8 allowedSides,uint16 priceBandBps,uint32 maxOracleAge,uint32 cooldown,uint256 maxOrderNotional,uint256 maxTotalNotional,uint256 nonce,uint256 deadline)"
            )
        );
    }

    // ------------------------------------------------------------------ fuzz / invariant-ish

    /// @notice However the agent picks quantity and price, it can never move more
    ///         notional than the owner signed for.
    function testFuzz_notionalNeverExceedsTheCap(uint128 qty, uint128 price) public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        vm.assume(qty > 0 && price > 0);

        vm.prank(agent);
        try argus.placeOrder(m, sig, Sides.BUY, qty, price, MARGIN) {
            (uint256 spent,,,) = argus.allowances(ownerAddr, m.nonce);
            assertLe(spent, m.maxOrderNotional, "accepted order stayed inside the per-order cap");
            assertLe(spent, m.maxTotalNotional);
        } catch {
            assertEq(exchange.calls(), 0, "a refused order never reached the exchange");
        }
    }

    /// @notice However far the agent pushes the price, an accepted order is always
    ///         inside the band the owner signed.
    function testFuzz_acceptedPriceIsAlwaysInsideTheBand(uint256 price) public {
        TradingMandate memory m = _mandate();
        bytes memory sig = _sign(m);
        price = bound(price, 1, REF * 3);

        vm.prank(agent);
        try argus.placeOrder(m, sig, Sides.BUY, QTY, price, MARGIN) {
            uint256 diff = price > REF ? price - REF : REF - price;
            assertLe((diff * 10_000) / REF, m.priceBandBps);
        } catch {}
    }
}
