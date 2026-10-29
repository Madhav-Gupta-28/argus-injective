import { createPublicClient, createWalletClient, http, defineChain, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN } from "./injective.js";
import type { Mandate } from "./mandate.js";

export const injectiveTestnet = defineChain(CHAIN);

const MANDATE_TUPLE =
  "(address owner,address agent,bytes32 marketId,bytes32 oracleBase,bytes32 oracleQuote,uint8 oracleType,uint8 idEncoding,uint8 allowedSides,uint16 priceBandBps,uint32 maxOracleAge,uint32 cooldown,uint256 maxOrderNotional,uint256 maxTotalNotional,uint256 nonce,uint256 deadline)";

export const ARGUS_ABI = parseAbi([
  `function referencePrice(${MANDATE_TUPLE} m) view returns (uint256 price1e18, uint256 age)`,
  `function preflight(${MANDATE_TUPLE} m, bytes signature, uint8 side, uint256 quantity1e18, uint256 price1e18) view returns (bool ok, string reason)`,
  `function placeOrder(${MANDATE_TUPLE} m, bytes signature, uint8 side, uint256 quantity1e18, uint256 price1e18, uint256 margin1e18) returns (string orderHash)`,
  `function mandateHash(${MANDATE_TUPLE} m) view returns (bytes32)`,
  "function allowances(address owner, uint256 nonce) view returns (uint256 spent, uint64 lastOrderAt, uint32 orders, bool revoked)",
  "function revoke(uint256 nonce)",
]);

export function publicClient() {
  return createPublicClient({ chain: injectiveTestnet, transport: http() });
}

export function walletClient(privateKey: `0x${string}`) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: injectiveTestnet,
    transport: http(),
  });
}

/// What the chain says this market is worth, and how long ago it said so.
/// The agent reads this through Argus, which reads it from the oracle
/// precompile — the same path the enforcement uses, so the agent can never be
/// looking at a different number than the one it will be judged against.
export async function referencePrice(argus: `0x${string}`, m: Mandate) {
  const [price1e18, age] = await publicClient().readContract({
    address: argus,
    abi: ARGUS_ABI,
    functionName: "referencePrice",
    args: [m],
  });
  return { price1e18, age };
}

/// Ask before acting. Returns the first failing check by name, so a refusal is
/// legible rather than just a reverted transaction.
export async function preflight(
  argus: `0x${string}`,
  agent: `0x${string}`,
  m: Mandate,
  signature: `0x${string}`,
  side: number,
  quantity1e18: bigint,
  price1e18: bigint,
) {
  const [ok, reason] = await publicClient().readContract({
    address: argus,
    abi: ARGUS_ABI,
    functionName: "preflight",
    args: [m, signature, side, quantity1e18, price1e18],
    account: agent,
  });
  return { ok, reason };
}

export async function placeOrder(
  argus: `0x${string}`,
  agentKey: `0x${string}`,
  m: Mandate,
  signature: `0x${string}`,
  side: number,
  quantity1e18: bigint,
  price1e18: bigint,
  margin1e18: bigint,
) {
  const wallet = walletClient(agentKey);
  const hash = await wallet.writeContract({
    address: argus,
    abi: ARGUS_ABI,
    functionName: "placeOrder",
    args: [m, signature, side, quantity1e18, price1e18, margin1e18],
  });
  const receipt = await publicClient().waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

export async function allowanceOf(argus: `0x${string}`, owner: `0x${string}`, nonce: bigint) {
  const [spent, lastOrderAt, orders, revoked] = await publicClient().readContract({
    address: argus,
    abi: ARGUS_ABI,
    functionName: "allowances",
    args: [owner, nonce],
  });
  return { spent, lastOrderAt, orders, revoked };
}
