// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Bech32} from "../src/Bech32.sol";

/// @notice Checked against independently computed bech32 vectors. If this ever
///         drifts, the exchange precompile rejects every order with "invalid
///         address", so these vectors are load-bearing.
contract Bech32Test is Test {
    function test_knownVectors() public pure {
        assertEq(
            Bech32.encodeInj(0x56f1c01de7d8d4F1468DAf945E65E5c7D32A8B32),
            "inj12mcuq808mr20z35d4729ue09clfj4zej7jlkcy"
        );
        assertEq(
            Bech32.encodeInj(0x0000000000000000000000000000000000000000),
            "inj1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe2hm49"
        );
        assertEq(
            Bech32.encodeInj(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF),
            "inj1llllllllllllllllllllllllllllllll4mk5j0"
        );
    }

    function test_alwaysWellFormed(address a) public pure {
        bytes memory s = bytes(Bech32.encodeInj(a));
        assertEq(s.length, 42, "inj + 1 + 32 data + 6 checksum");
        assertEq(s[0], "i");
        assertEq(s[1], "n");
        assertEq(s[2], "j");
        assertEq(s[3], "1");
        for (uint256 i = 4; i < s.length; ++i) {
            assertTrue(_inCharset(s[i]), "every char is in the bech32 charset");
        }
    }

    function _inCharset(bytes1 c) internal pure returns (bool) {
        for (uint256 i = 0; i < 32; ++i) {
            if (Bech32.CHARSET[i] == c) return true;
        }
        return false;
    }
}
