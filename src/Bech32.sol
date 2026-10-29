// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Bech32 — encode a 20-byte EVM address as an `inj1…` account address.
///
/// @notice Injective's exchange precompile takes `feeRecipient` as a Cosmos
///         account address, so a `0x…` string is rejected with "invalid
///         address". Rather than ask the caller to supply a bech32 string the
///         contract cannot verify — which would let a relayer point fees at
///         themselves — the address is derived here from the EVM address.
///
/// @dev Injective keys are ethsecp256k1, so the account address is the same 20
///      bytes as the EVM address, bech32-encoded with the `inj` prefix. 20
///      bytes is 160 bits, exactly 32 groups of 5, so no padding case arises.
library Bech32 {
    bytes internal constant CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

    /// @notice bech32 checksum over the expanded hrp and 5-bit data groups.
    function polymod(uint8[] memory values) internal pure returns (uint32 chk) {
        uint32[5] memory GEN = [uint32(0x3b6a57b2), 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
        chk = 1;
        for (uint256 i = 0; i < values.length; ++i) {
            uint32 top = chk >> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ uint32(values[i]);
            for (uint256 j = 0; j < 5; ++j) {
                if (((top >> j) & 1) == 1) chk ^= GEN[j];
            }
        }
    }

    /// @notice Encode `addr` as an Injective `inj1…` address.
    function encodeInj(address addr) internal pure returns (string memory) {
        // hrp "inj" expanded: high bits, separator, low bits.
        bytes memory hrp = "inj";

        // 20 bytes -> 32 groups of 5 bits.
        uint8[] memory data = new uint8[](32);
        uint160 v = uint160(addr);
        for (uint256 i = 0; i < 32; ++i) {
            // Take the i-th 5-bit group, most significant first.
            data[i] = uint8((v >> (155 - 5 * i)) & 0x1f);
        }

        // values = hrp_expand(hrp) || data || [0,0,0,0,0,0]
        uint8[] memory values = new uint8[](hrp.length * 2 + 1 + 32 + 6);
        uint256 k;
        for (uint256 i = 0; i < hrp.length; ++i) {
            values[k++] = uint8(hrp[i]) >> 5;
        }
        values[k++] = 0;
        for (uint256 i = 0; i < hrp.length; ++i) {
            values[k++] = uint8(hrp[i]) & 31;
        }
        for (uint256 i = 0; i < 32; ++i) {
            values[k++] = data[i];
        }
        // trailing six zeros already in place

        uint32 chk = polymod(values) ^ 1;

        bytes memory out = new bytes(hrp.length + 1 + 32 + 6);
        uint256 p;
        for (uint256 i = 0; i < hrp.length; ++i) {
            out[p++] = hrp[i];
        }
        out[p++] = "1";
        for (uint256 i = 0; i < 32; ++i) {
            out[p++] = CHARSET[data[i]];
        }
        for (uint256 i = 0; i < 6; ++i) {
            out[p++] = CHARSET[(chk >> uint32(5 * (5 - i))) & 31];
        }
        return string(out);
    }
}
