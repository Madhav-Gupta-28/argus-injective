// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOracleModule} from "../src/injective/Oracle.sol";
import {IExchangeModule} from "../src/injective/Exchange.sol";
import {ExchangeTypes} from "../src/injective/ExchangeTypes.sol";

/// @notice Stand-in for Injective's oracle precompile, etched at 0x…0067 in unit
///         tests. Lets a test put the chain's price and its age under direct
///         control, including the two states that matter most: no price at all,
///         and a price that has gone stale.
contract MockOracle {
    uint256 public pairPrice;
    uint64 public ts;
    bool public reverts;

    function set(uint256 price1e18, uint64 timestamp) external {
        pairPrice = price1e18;
        ts = timestamp;
        reverts = false;
    }

    function setReverts(bool v) external {
        reverts = v;
    }

    function oraclePrice(uint8, string calldata, string calldata) external view returns (uint256) {
        if (reverts) revert("no price for oracle was found");
        return pairPrice;
    }

    function oraclePricePairState(uint8, string calldata, string calldata)
        external
        view
        returns (IOracleModule.PricePairState memory s)
    {
        if (reverts) revert("no price for oracle was found");
        s.pairPrice = pairPrice;
        s.basePrice = pairPrice;
        s.quotePrice = 0;
        s.baseTimestamp = ts;
        s.quoteTimestamp = ts;
    }
}

/// @notice Stand-in for Injective's exchange precompile, etched at 0x…0065.
///         Records what it was asked to do so a test can assert that the order
///         which reached the exchange is exactly the order the mandate allowed.
contract MockExchange {
    string public lastMarketId;
    string public lastSubaccountId;
    string public lastOrderType;
    uint256 public lastPrice;
    uint256 public lastQuantity;
    uint256 public lastMargin;
    address public lastSender;
    uint256 public calls;
    bool public reverts;

    function setReverts(bool v) external {
        reverts = v;
    }

    function createDerivativeMarketOrder(address sender, IExchangeModule.DerivativeOrder calldata order)
        external
        returns (IExchangeModule.CreateDerivativeMarketOrderResponse memory res)
    {
        if (reverts) revert("exchange refused");
        calls += 1;
        lastSender = sender;
        lastMarketId = order.marketID;
        lastSubaccountId = order.subaccountID;
        lastOrderType = order.orderType;
        lastPrice = ExchangeTypes.UFixed256x18.unwrap(order.price);
        lastQuantity = ExchangeTypes.UFixed256x18.unwrap(order.quantity);
        lastMargin = ExchangeTypes.UFixed256x18.unwrap(order.margin);
        res.orderHash = "0xmockorderhash";
        res.cid = order.cid;
        res.quantity = order.quantity;
        res.price = order.price;
    }
}
