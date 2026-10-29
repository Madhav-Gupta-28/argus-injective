// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArgusMandate} from "../src/ArgusMandate.sol";

/// @notice Deploys ArgusMandate to Injective EVM.
///
/// @dev The guardian defaults to the deployer and can be rotated afterwards.
///      Nothing else is configured at deploy time: the contract holds no funds,
///      has no market allowlist of its own, and gains authority only from the
///      mandates owners sign.
///
///      forge script script/Deploy.s.sol --rpc-url inj_testnet --broadcast \
///        --private-key $PRIVATE_KEY
contract Deploy is Script {
    function run() external returns (ArgusMandate argus) {
        address guardian = vm.envOr("GUARDIAN", address(0));

        vm.startBroadcast();
        argus = new ArgusMandate(guardian);
        vm.stopBroadcast();

        console.log("ArgusMandate       ", address(argus));
        console.log("owner              ", argus.owner());
        console.log("guardian           ", argus.guardian());
        console.log("oracle precompile  ", address(argus.ORACLE()));
        console.log("exchange precompile", address(argus.EXCHANGE()));
        console.log("maxAllowedBandBps  ", argus.maxAllowedBandBps());
        console.log("maxAllowedOracleAge", argus.maxAllowedOracleAge());
    }
}
