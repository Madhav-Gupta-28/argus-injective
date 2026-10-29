import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { resolveMarket, CHAIN } from "./injective.js";
import { buildMandate, signMandate, SIDES } from "./mandate.js";
import { ARGUS_ABI, publicClient, walletClient } from "./argus.js";

/// Broadcasts an order the mandate forbids, with an explicit gas limit so it is
/// mined rather than rejected during estimation.
///
/// A refusal that only ever appears in `eth_call` is easy to wave away. This
/// puts one on-chain: a real transaction, from the agent's own key, that the
/// contract reverts. The explorer link is the receipt.
async function main() {
  const ARGUS = process.env.ARGUS_ADDRESS as `0x${string}`;
  const OWNER_KEY = process.env.OWNER_PRIVATE_KEY as `0x${string}`;
  const AGENT_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  if (!ARGUS || !OWNER_KEY || !AGENT_KEY) throw new Error("see .env.example");

  const owner = privateKeyToAccount(OWNER_KEY).address;
  const agent = privateKeyToAccount(AGENT_KEY).address;
  const market = await resolveMarket("BTC");

  const mandate = buildMandate(owner, agent, market, {
    priceBandBps: 100,
    maxOracleAge: 300,
    cooldown: 0,
    maxOrderNotional: 2_000n * 10n ** 18n,
    maxTotalNotional: 10_000n * 10n ** 18n,
    nonce: BigInt(process.env.NONCE ?? "1"),
  });
  const signature = await signMandate(OWNER_KEY, ARGUS, CHAIN.id, mandate);

  const pub = publicClient();
  const [ref] = await pub.readContract({
    address: ARGUS,
    abi: ARGUS_ABI,
    functionName: "referencePrice",
    args: [mandate],
  });

  // 10% below the oracle: outside the 1% band the owner signed.
  const badPrice = (ref * 9_000n) / 10_000n;
  console.log(`oracle     $${(Number(ref) / 1e18).toFixed(2)}`);
  console.log(`submitting $${(Number(badPrice) / 1e18).toFixed(2)}  (10% below, band is 1%)\n`);

  const wallet = walletClient(AGENT_KEY);
  const hash = await wallet.writeContract({
    address: ARGUS,
    abi: ARGUS_ABI,
    functionName: "placeOrder",
    args: [mandate, signature, SIDES.BUY, 10n ** 16n, badPrice, 10n ** 19n],
    gas: 500_000n, // skip estimation so the revert is mined, not predicted
  });
  console.log(`tx       ${hash}`);

  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`status   ${receipt.status}   ${receipt.status === "reverted" ? "(refused on-chain)" : ""}`);
  console.log(`gas used ${receipt.gasUsed}`);
  console.log(`explorer ${CHAIN.blockExplorers.default.url}/tx/${hash}`);

  if (receipt.status !== "reverted") throw new Error("expected this order to be refused");
}

main().catch((e) => {
  console.error(e?.shortMessage ?? e?.message ?? e);
  process.exit(1);
});
