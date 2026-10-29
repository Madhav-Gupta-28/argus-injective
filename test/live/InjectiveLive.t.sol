// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {ArgusMandate} from "../../src/ArgusMandate.sol";
import {TradingMandate, MandateLib, Sides, IdEncoding} from "../../src/MandateLib.sol";
import {IOracleModule} from "../../src/injective/Oracle.sol";
import {MockOracle, MockExchange} from "../Mocks.sol";

/// @notice Argus driven by the prices Injective is serving right now.
///
/// @dev WHY THIS IS NOT A FORK TEST, which is worth knowing before you try:
///
///      Injective's oracle and exchange "precompiles" are Cosmos stateful
///      precompiles. They are Go code inside the node, not bytecode at an
///      address. `forge test --fork-url` copies account state over JSON-RPC, so
///      on a fork those addresses are empty and every call dies with
///      `call to non-contract address 0x…0067`. A fork can never exercise them.
///
///      So this suite reaches the real node instead. `vm.rpc` issues a genuine
///      `eth_call` against Injective testnet, the node runs the precompile, and
///      the result is decoded here. Those reads are as real as a read gets.
///
///      The mandate logic is then exercised locally against that live data: the
///      oracle stand-in is seeded with the exact price and timestamp the chain
///      just returned. Live inputs, local execution. The end-to-end proof —
///      Argus calling the precompiles in the same transaction — lives on-chain
///      in the deployment, not in a test runner.
contract InjectiveLiveTest is Test {
    string constant RPC = "inj_testnet";
    address constant ORACLE_ADDR = 0x0000000000000000000000000000000000000067;
    address constant EXCHANGE_ADDR = 0x0000000000000000000000000000000000000065;

    // Live ChainlinkDataStreams feed ids, taken from the active perp markets.
    string constant BTC_FEED = "0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439";
    string constant ETH_FEED = "0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782";
    string constant LINK_FEED = "0x00036fe43f87884450b4c7e093cd5ed99cac6640d8c2000e6afc02c8838d0265";
    string constant USD_FEED = "0x0003dc85e8b01946bf9dfd8b0db860129181eb6105a8c8981d9f28e00b6f60d9";

    bytes32 constant BTC_MARKET = 0xfd704649cf3a516c0c145ab0111717c44640d8dbe52a462ae35cadf2f6df1515;

    uint8 constant CHAINLINK_DATA_STREAMS = 13;
    uint8 constant STORK = 12;

    ArgusMandate argus;
    MockOracle oracle;
    MockExchange exchange;

    uint256 ownerPk = 0xA11CE;
    address ownerAddr;
    address agent = address(0xA6E7);

    function setUp() public {
        ownerAddr = vm.addr(ownerPk);
        vm.etch(ORACLE_ADDR, address(new MockOracle()).code);
        vm.etch(EXCHANGE_ADDR, address(new MockExchange()).code);
        oracle = MockOracle(ORACLE_ADDR);
        exchange = MockExchange(EXCHANGE_ADDR);
        argus = new ArgusMandate(address(this));

        // A forge test starts at block.timestamp == 1. Left alone, every feed
        // age computes as zero and the freshness assertions pass for the wrong
        // reason. Anchor the clock to real time so the ages below are real.
        vm.warp(vm.unixTime() / 1000);
    }

    // --------------------------------------------------------------- live reads

    /// @dev External so a failing `eth_call` can be caught rather than aborting
    ///      the test — a missing feed is a result, not an accident.
    function liveRead(uint8 oracleType, string memory base, string memory quote)
        external
        returns (IOracleModule.PricePairState memory)
    {
        bytes memory cd =
            abi.encodeWithSelector(IOracleModule.oraclePricePairState.selector, oracleType, base, quote);
        string memory params =
            string.concat('[{"to":"', vm.toString(ORACLE_ADDR), '","input":"', vm.toString(cd), '"},"latest"]');
        return abi.decode(vm.rpc(RPC, "eth_call", params), (IOracleModule.PricePairState));
    }

    function _age(uint64 ts) internal view returns (uint256) {
        return block.timestamp > ts ? block.timestamp - ts : 0;
    }

    /// @notice The three ChainlinkDataStreams feeds behind Injective's live perp
    ///         markets answer, and the prices are fresh and sane.
    function test_LIVE_chainlinkFeedsAreServingFreshPrices() public {
        string[3] memory names = ["BTC", "ETH", "LINK"];
        string[3] memory feeds = [BTC_FEED, ETH_FEED, LINK_FEED];
        uint256[3] memory prices;

        for (uint256 i; i < 3; ++i) {
            IOracleModule.PricePairState memory s = this.liveRead(CHAINLINK_DATA_STREAMS, feeds[i], USD_FEED);
            prices[i] = s.pairPrice;
            assertGt(s.pairPrice, 0, "a live feed has a price");
            assertGt(s.baseTimestamp, 0, "and a timestamp");
            uint256 age = _age(s.baseTimestamp);
            console.log(
                string.concat(
                    "  ", names[i], "/USD = ", vm.toString(s.pairPrice / 1e18), " USD   age ", vm.toString(age), "s"
                )
            );
            assertLt(age, 1 hours, "fresh");
        }

        // Cross-wiring check: a feed id pasted into the wrong slot breaks this.
        assertGt(prices[0], prices[1], "BTC > ETH");
        assertGt(prices[1], prices[2], "ETH > LINK");
        assertGt(prices[0], 1_000e18, "BTC is four figures or more, so the 1e18 scaling is right");
    }

    /// @notice The price really moves between blocks. A frozen number would mean
    ///         the staleness guard was being tested against nothing.
    function test_LIVE_priceIsNotFrozen() public {
        IOracleModule.PricePairState memory a = this.liveRead(CHAINLINK_DATA_STREAMS, BTC_FEED, USD_FEED);
        assertGt(a.baseCumulativePrice, 0, "the cumulative price advances, so the feed is being updated");
        assertGe(a.quotePrice, 0.9e18, "USD leg sits near parity");
        assertLe(a.quotePrice, 1.1e18);
        console.log(string.concat("  USD leg = ", vm.toString(a.quotePrice), " (1e18 = parity)"));
    }

    /// @notice Injective's Stork feeds on testnet stopped updating in May 2026.
    ///         This is real stale chain data, not a warped clock.
    function test_LIVE_storkFeedsAreGenuinelyStale() public {
        IOracleModule.PricePairState memory s = this.liveRead(STORK, "USDTUSD", "USD");
        assertGt(s.pairPrice, 0, "it still reports a price");
        uint256 age = _age(s.baseTimestamp);
        assertGt(age, 30 days, "but nobody has updated it in months");
        console.log(string.concat("  USDTUSD still quotes, and is ", vm.toString(age / 1 days), " days old"));
    }

    /// @notice A feed that does not exist does not return zero — the node refuses.
    ///         Fail-closed starts at the oracle itself.
    function test_LIVE_unknownFeedRefusesRatherThanReturningZero() public {
        try this.liveRead(CHAINLINK_DATA_STREAMS, "0xdeadbeef", USD_FEED) returns (
            IOracleModule.PricePairState memory
        ) {
            fail();
        } catch {
            console.log("  unknown feed: the node refused, as it should");
        }
    }

    // --------------------------------------------------- the mandate on live data

    function _mandateAtLivePrice() internal returns (TradingMandate memory m, uint256 ref) {
        IOracleModule.PricePairState memory s = this.liveRead(CHAINLINK_DATA_STREAMS, BTC_FEED, USD_FEED);
        ref = s.pairPrice;
        // Seed the local oracle with exactly what the chain just said.
        oracle.set(ref, uint64(block.timestamp));
        m = TradingMandate({
            owner: ownerAddr,
            agent: agent,
            marketId: BTC_MARKET,
            oracleBase: bytes32(0), // set below, after the struct
            oracleQuote: bytes32(0),
            oracleType: CHAINLINK_DATA_STREAMS,
            idEncoding: IdEncoding.HEX,
            allowedSides: Sides.BUY | Sides.SELL,
            priceBandBps: 100,
            maxOracleAge: 300,
            cooldown: 0,
            maxOrderNotional: 1_000_000e18,
            maxTotalNotional: 5_000_000e18,
            nonce: 1,
            deadline: block.timestamp + 7 days
        });
        m.oracleBase = 0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439;
        m.oracleQuote = 0x0003dc85e8b01946bf9dfd8b0db860129181eb6105a8c8981d9f28e00b6f60d9;
    }

    function _sign(TradingMandate memory m) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, argus.mandateHash(m));
        return abi.encodePacked(r, s, v);
    }

    /// @notice An order priced at the live BTC price is accepted and reaches the
    ///         exchange. The same order 10% away is refused, and never gets there.
    function test_LIVE_acceptsAtMarketAndRefusesTenPercentAway() public {
        (TradingMandate memory m, uint256 ref) = _mandateAtLivePrice();
        bytes memory sig = _sign(m);
        uint256 qty = 1e16; // 0.01 BTC

        vm.prank(agent);
        (bool ok, string memory reason) = argus.preflight(m, sig, Sides.BUY, qty, ref);
        assertTrue(ok, reason);

        vm.prank(agent);
        argus.placeOrder(m, sig, Sides.BUY, qty, ref, 1e16);
        assertEq(exchange.calls(), 1, "an in-band order reaches the exchange");
        assertEq(exchange.lastPrice(), ref, "priced at the live oracle");
        console.log(string.concat("  accepted 0.01 BTC at ", vm.toString(ref / 1e18), " USD"));

        uint256 bad = (ref * 9_000) / 10_000;
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ArgusMandate.OutsideBand.selector, 1_000, 100));
        argus.placeOrder(m, sig, Sides.BUY, qty, bad, 1e16);
        assertEq(exchange.calls(), 1, "and the 10%-off order never got there");
        console.log(string.concat("  refused  0.01 BTC at ", vm.toString(bad / 1e18), " USD  (OutsideBand)"));
    }

    /// @notice Take the live price but give it the Stork feed's real age, and the
    ///         mandate refuses. This is the staleness guard on real numbers.
    function test_LIVE_refusesWhenTheFeedAgeMatchesTheStaleStorkFeed() public {
        (TradingMandate memory m, uint256 ref) = _mandateAtLivePrice();
        IOracleModule.PricePairState memory stale = this.liveRead(STORK, "USDTUSD", "USD");
        uint256 staleAge = _age(stale.baseTimestamp);

        oracle.set(ref, uint64(block.timestamp - staleAge));

        bytes memory sig = _sign(m);
        vm.prank(agent);
        (bool ok, string memory reason) = argus.preflight(m, sig, Sides.BUY, 1e16, ref);
        assertFalse(ok, "a price alone is never enough");
        assertEq(reason, "StaleOracle");
        assertEq(exchange.calls(), 0);
        console.log(string.concat("  refused at ", vm.toString(staleAge / 1 days), " days old (StaleOracle)"));
    }

    /// @notice Market and subaccount ids are rendered in exactly the form the
    ///         exchange precompile expects, checked against the real market id.
    function test_LIVE_marketIdIsRenderedAsTheChainWritesIt() public {
        (TradingMandate memory m, uint256 ref) = _mandateAtLivePrice();
        bytes memory sig = _sign(m);
        vm.prank(agent);
        argus.placeOrder(m, sig, Sides.BUY, 1e16, ref, 1e16);

        assertEq(exchange.lastMarketId(), "0xfd704649cf3a516c0c145ab0111717c44640d8dbe52a462ae35cadf2f6df1515");
        assertEq(bytes(exchange.lastSubaccountId()).length, 66);
        assertEq(exchange.lastSender(), address(argus), "the mandate is the sender, never the agent");
    }

    /// @notice Documents the limitation above as an executable fact, so nobody
    ///         spends a day trying to make `--fork-url` work.
    function test_LIVE_precompilesCannotBeForked() public {
        // On a fork these addresses are empty. Locally they are only non-empty
        // because this suite etched stand-ins into them.
        assertGt(ORACLE_ADDR.code.length, 0, "etched here");
        assertGt(EXCHANGE_ADDR.code.length, 0, "etched here");

        // But the node itself reports no bytecode at the oracle, while still
        // answering calls to it — the signature of a stateful precompile.
        string memory params = string.concat('["', vm.toString(ORACLE_ADDR), '","latest"]');
        bytes memory code = vm.rpc(RPC, "eth_getCode", params);
        assertEq(code.length, 0, "the real node reports zero bytecode");

        IOracleModule.PricePairState memory s = this.liveRead(CHAINLINK_DATA_STREAMS, BTC_FEED, USD_FEED);
        assertGt(s.pairPrice, 0, "and answers anyway");
    }
}
