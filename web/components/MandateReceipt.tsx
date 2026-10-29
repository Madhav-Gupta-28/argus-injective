"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CountUp } from "./CountUp";
import { REFUSAL_TX, txUrl } from "@/lib/chain";

/**
 * The hero "product object" — a refusal receipt. The Mantle version of Argus
 * showed what a rescue returned to you; here the thing worth showing is what
 * the agent could *not* do, which is the whole product in one card.
 *
 * The numbers are the real ones from the mined refusal: the oracle at the time,
 * the price the agent asked for, and the revert the contract produced.
 */
export function MandateReceipt() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setArmed(true);
      return;
    }
    const t = window.setTimeout(() => setArmed(true), 260);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* soft glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(34,197,94,0.22), rgba(34,197,94,0.06) 60%, transparent)",
        }}
      />

      <div
        className="animate-riseIn rounded-2xl border border-argus-line bg-argus-card px-5 pt-5 shadow-lift"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-argus-ink">
            Argus · Order
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-md border border-argus-red/30 bg-argus-red/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-argus-red transition-all duration-500 ${
              armed ? "scale-100 opacity-100" : "scale-90 opacity-0"
            }`}
          >
            ✗ Refused
          </span>
        </div>
        <div className="mt-0.5 font-mono text-[11.5px] text-argus-faint">
          injective · decided before the exchange
        </div>

        <Dashed />

        <Row k="Your band" v="±1.00%" />
        <Row k="Oracle says" v="$80,184.24" />
        <div className="mt-3 flex items-center justify-between text-[14px]">
          <span className="text-argus-dim">Agent asked for</span>
          <span className="stat-num font-medium text-argus-red">$72,165.82</span>
        </div>

        {/* deviation bar with the band marker at 10% of the track */}
        <div className="relative mt-2 h-[6px] overflow-hidden rounded-full bg-argus-bg">
          <div
            className="h-full rounded-full bg-argus-red transition-[width] duration-[1100ms] ease-out"
            style={{ width: armed ? "100%" : "0%" }}
          />
          <span
            aria-hidden
            className="absolute top-[-2px] h-[10px] w-px bg-argus-ink/50"
            style={{ left: "10%" }}
          />
        </div>
        <div className="mt-1 text-right font-mono text-[10.5px] text-argus-faint">
          1000 bps away · band is 100 bps
        </div>

        <Dashed />

        <div className="flex items-end justify-between">
          <span className="pb-1 text-[13px] text-argus-dim">Moved outside your mandate</span>
          <span className="stat-num text-[42px] font-semibold leading-none tracking-tight text-argus-green">
            <CountUp value="$0" durationMs={1400} />
          </span>
        </div>
        <div className="mt-1 text-right font-mono text-[11px] text-argus-faint">
          the agent holds the key · never the authority
        </div>

        <a
          href={txUrl(REFUSAL_TX)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 -mx-5 block rounded-b-2xl bg-argus-green/10 px-5 py-3 text-center font-mono text-[11.5px] leading-snug text-argus-green transition-colors hover:bg-argus-green/[0.16]"
        >
          OutsideBand(1000, 100) · reverted on-chain · verify →
        </a>
      </div>
    </div>
  );
}

function Dashed() {
  return (
    <div
      className="my-4 h-px"
      style={{
        background:
          "repeating-linear-gradient(90deg, var(--argus-line) 0 5px, transparent 5px 10px)",
      }}
    />
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-between text-[14px] first:mt-0">
      <span className="text-argus-dim">{k}</span>
      <span className="stat-num text-argus-ink">{v}</span>
    </div>
  );
}
