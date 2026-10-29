import {
  ARGUS,
  ARGUS_INJ,
  ORACLE_PRECOMPILE,
  EXCHANGE_PRECOMPILE,
  REFUSAL_TX,
  addressUrl,
  txUrl,
} from "@/lib/chain";

const short = (s: string) => `${s.slice(0, 10)}…${s.slice(-6)}`;

/** Everything a reviewer needs to check the claims without trusting the page. */
export function Deployed() {
  const rows: { k: string; v: React.ReactNode }[] = [
    {
      k: "ArgusMandate",
      v: (
        <a href={addressUrl(ARGUS)} target="_blank" rel="noreferrer" className="text-argus-accent hover:underline">
          {ARGUS}
        </a>
      ),
    },
    { k: "Injective account", v: ARGUS_INJ },
    { k: "Chain", v: "Injective EVM testnet · id 1439" },
    { k: "Oracle precompile", v: ORACLE_PRECOMPILE },
    { k: "Exchange precompile", v: EXCHANGE_PRECOMPILE },
    {
      k: "A refusal, mined",
      v: (
        <>
          <a href={txUrl(REFUSAL_TX)} target="_blank" rel="noreferrer" className="text-argus-accent hover:underline">
            {short(REFUSAL_TX)}
          </a>
          <span className="ml-2 text-argus-red">reverted OutsideBand(1000, 100)</span>
        </>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-argus-line bg-argus-card shadow-card">
      {rows.map((r, i) => (
        <div
          key={r.k}
          className={`flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-6 ${
            i > 0 ? "border-t border-argus-line" : ""
          }`}
        >
          <div className="w-44 shrink-0 font-mono text-[10.5px] uppercase tracking-label text-argus-faint">
            {r.k}
          </div>
          <div className="break-all font-mono text-[12.5px] text-argus-ink">{r.v}</div>
        </div>
      ))}
    </div>
  );
}
