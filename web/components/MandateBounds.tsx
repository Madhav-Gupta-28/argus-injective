import { Tooltip } from "./ui";

/**
 * What a single signature bounds. The Mantle build showed six risk signals
 * folding into one score; the mandate is the mirror image — one signature
 * fanning out into every limit the agent will be held to.
 */
const BOUNDS = [
  { f: "marketId", t: "the only market that can be traded", d: "A mandate names one market. An agent holding it cannot touch any other, however it is prompted." },
  { f: "oracleType · base · quote", t: "the only price source that counts", d: "The feed the contract reads to decide. The agent never supplies a price the contract trusts." },
  { f: "idEncoding", t: "how that feed is named", d: "Injective names feeds two ways — 32-byte ids and plain symbols — and the oracle type does not disclose which. The owner states it rather than letting the contract guess." },
  { f: "allowedSides", t: "long-only, short-only, or both", d: "A long-only mandate cannot be made to short, even by a compromised agent." },
  { f: "priceBandBps", t: "how far from the oracle an order may be priced", d: "Checked against a price the contract derived itself, in the same transaction." },
  { f: "maxOracleAge", t: "how stale the price may be before trading stops", d: "Fail-closed: when the feed goes quiet the mandate stops authorising anything." },
  { f: "maxOrderNotional", t: "the largest single order", d: "A prompt-injected size is arithmetic, not judgement — the contract simply refuses." },
  { f: "maxTotalNotional", t: "the most this mandate can ever trade", d: "A lifetime budget. Spend accrues on-chain and cannot be reset by the agent." },
  { f: "cooldown", t: "minimum seconds between orders", d: "Bounds a looping or thrashing agent without needing to detect that it is looping." },
  { f: "agent", t: "who may relay — zero means anyone", d: "Pairwise separation: the party that proposes is never the party that authorises." },
  { f: "nonce", t: "revocable at any time", d: "The owner revokes on-chain; every order under that nonce stops immediately." },
  { f: "deadline", t: "expires on its own", d: "A forgotten mandate is not a standing one." },
];

export function MandateBounds() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-argus-line bg-argus-line sm:grid-cols-2 lg:grid-cols-3">
      {BOUNDS.map((b) => (
        <div key={b.f} className="group bg-argus-card p-5 transition-colors hover:bg-argus-tint">
          <Tooltip text={b.d}>
            <span className="font-mono text-[12px] font-semibold text-argus-accent">{b.f}</span>
          </Tooltip>
          <p className="mt-2 text-[14px] leading-snug text-argus-dim">{b.t}</p>
        </div>
      ))}
    </div>
  );
}
