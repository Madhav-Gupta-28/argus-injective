import Link from "next/link";
import { SectionLabel, StatusPill } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { MandateReceipt } from "@/components/MandateReceipt";
import { MandateBounds } from "@/components/MandateBounds";
import { MandateLoop } from "@/components/MandateLoop";
import { Deployed } from "@/components/Deployed";
import { LiveProof } from "@/components/LiveProof";
import { Terminal, T } from "@/components/Terminal";
import { REPO } from "@/lib/chain";

export default function Home() {
  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="animate-riseIn">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-argus-inj/30 bg-argus-inj/10 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-argus-inj">
                <span className="h-1.5 w-1.5 animate-scan rounded-full bg-argus-inj" />
                Live on Injective EVM testnet
              </span>
              <span className="inline-flex items-center rounded-lg border border-argus-line bg-argus-card px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-argus-dim">
                Oracle + exchange precompiles
              </span>
            </div>

            <h1 className="mt-7 font-display text-6xl leading-[0.95] tracking-tight text-argus-ink sm:text-7xl">
              The agent proposes.
              <br />
              <span className="text-argus-accent">The chain decides.</span>
            </h1>

            <p className="mt-7 max-w-md text-lg leading-relaxed text-argus-dim">
              An AI agent can place orders for you. It cannot decide what it is allowed to do. You
              sign the limits once; Argus re-derives the price from Injective&apos;s oracle
              precompile and refuses anything outside them — before the order reaches the exchange.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/proof" className="btn-primary">
                Watch it refuse, live
                <span aria-hidden>→</span>
              </Link>
              <a href={REPO} target="_blank" rel="noreferrer" className="btn-ghost">
                Read the code
              </a>
            </div>
          </div>

          <div>
            <MandateReceipt />
          </div>
        </div>
      </section>

      {/* ---------------- THE PROBLEM ---------------- */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionLabel>The problem</SectionLabel>
            <h2 className="mt-5 font-display text-5xl leading-[0.98] tracking-tight text-argus-ink sm:text-6xl">
              Agents are fast.
              <br />
              <span className="text-argus-accent">Trust isn&apos;t.</span>
            </h2>
            <p className="mt-6 max-w-md text-argus-dim">
              Give an agent a key and you have given it your whole balance. Its judgement is a model
              output — shaped by stale context, bad data, or a sentence someone slipped into a web
              page it read.
            </p>
            <p className="mt-4 max-w-md text-argus-dim">
              <span className="font-medium text-argus-ink">
                Argus never asks the agent what the price is.
              </span>{" "}
              It reads the oracle itself, in the same transaction, and judges the order against what
              the owner signed.
            </p>
          </Reveal>

          <Reveal delayMs={120}>
            <Terminal header="an agent, mid-task">
              {"agent says      "}
              {T.hl('"BTC is oversold — buy 500 BTC at 72,165"')}
              {"\nits evidence    a model, a prompt, and whatever it just read\n\n"}
              {"oracle says     "}
              {T.ok("$80,184.24")}
              {"   age 0s   ← read on-chain\nyour mandate    "}
              {T.hl("±1.00% band · $2,000 per order")}
              {"\n\n"}
              {T.big("VERDICT   ")}
              {T.no("●")}
              {T.big(" refused — ")}
              {T.no("OutsideBand(1000, 100)")}
              {"\n          "}
              {T.big("and ")}
              {T.no("NotionalCapExceeded")}
            </Terminal>
          </Reveal>
        </div>
      </section>

      {/* ---------------- WHAT THE MANDATE BOUNDS ---------------- */}
      <div className="border-y border-argus-line bg-argus-tint">
        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
          <Reveal>
            <SectionLabel>What one signature bounds</SectionLabel>
            <h2 className="mt-5 font-display text-5xl tracking-tight text-argus-ink sm:text-6xl">
              One signature. <span className="text-argus-accent">Twelve bounds.</span>
            </h2>
            <p className="mt-5 max-w-xl text-argus-dim">
              The owner signs an EIP-712 <span className="font-mono text-[14px]">TradingMandate</span>{" "}
              once, offline, and never needs gas again. Every field below is re-checked on-chain
              before any order is passed on.
            </p>
          </Reveal>
          <Reveal delayMs={120} className="mt-14">
            <MandateBounds />
          </Reveal>
        </section>
      </div>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-5 font-display text-5xl leading-[0.98] tracking-tight text-argus-ink sm:text-6xl">
              Sign once. <span className="text-argus-accent">Bounded always.</span>
            </h2>
            <p className="mt-6 max-w-md text-lg text-argus-dim">
              The agent holds a key. It never holds the authority.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { n: "01", t: "Sign", d: "One mandate. Your key never leaves your wallet." },
                { n: "02", t: "Relay", d: "The agent proposes an order. That is all it can do." },
                { n: "03", t: "Decide", d: "Argus re-derives the price and refuses, or passes it to the CLOB." },
              ].map((s) => (
                <div key={s.n}>
                  <div className="stat-num text-sm font-semibold text-argus-accent">{s.n}</div>
                  <div className="mt-1.5 font-display text-lg text-argus-ink">{s.t}</div>
                  <p className="mt-1 text-sm leading-relaxed text-argus-dim">{s.d}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delayMs={120} className="flex justify-center">
            <MandateLoop />
          </Reveal>
        </div>
      </section>

      {/* ---------------- PROOF ---------------- */}
      <div className="border-y border-argus-line bg-argus-tint">
        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Reveal>
              <SectionLabel>On-chain proof</SectionLabel>
              <h2 className="mt-5 font-display text-5xl tracking-tight text-argus-ink sm:text-6xl">
                It&apos;s all real.{" "}
                <span className="text-argus-accent">Check it yourself.</span>
              </h2>
              <p className="mt-5 max-w-xl text-argus-dim">
                The block below is not a recording. Your browser is calling the deployed contract on
                Injective testnet right now, and these are its answers.
              </p>
            </Reveal>
            <StatusPill tone="good">Chain 1439</StatusPill>
          </div>

          <Reveal className="mt-12">
            <LiveProof />
          </Reveal>

          <Reveal className="mt-8">
            <Deployed />
          </Reveal>
        </section>
      </div>

      {/* ---------------- WHY INJECTIVE ---------------- */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
        <Reveal>
          <SectionLabel>Why this needs Injective</SectionLabel>
          <h2 className="mt-5 font-display text-5xl tracking-tight text-argus-ink sm:text-6xl">
            Not a port <span className="text-argus-accent">looking for a chain.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-argus-line bg-argus-line md:grid-cols-3">
          {[
            {
              k: "0x…0067",
              t: "The oracle precompile",
              d: "Lets the contract re-derive the reference price in the same transaction as the order, with a timestamp. The agent cannot sit between the mandate and its price source.",
            },
            {
              k: "0x…0065",
              t: "The exchange precompile",
              d: "The order goes straight to Injective's native central limit order book from Solidity. No AMM, no router, no bridge.",
            },
            {
              k: "135 markets",
              t: "Where RWA already trades",
              d: "Nearly half of all markets on the chain are RWA. Agents trading those need mandates before institutions let them near a position.",
            },
          ].map((c) => (
            <div key={c.t} className="bg-argus-card p-7">
              <div className="font-mono text-[11px] uppercase tracking-label text-argus-inj">{c.k}</div>
              <h3 className="mt-3 font-display text-2xl text-argus-ink">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-argus-dim">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CLOSING ---------------- */}
      <section className="relative mx-auto max-w-7xl px-5 py-32 text-center sm:px-8 sm:py-40">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 opacity-80"
          style={{
            background: "radial-gradient(600px 300px at 50% 0%, rgba(22,163,74,0.12), transparent 70%)",
          }}
        />
        <Reveal>
          <SectionLabel>The watchman</SectionLabel>
          <h2 className="mx-auto mt-6 max-w-4xl font-display text-6xl leading-[0.95] tracking-tight text-argus-ink sm:text-7xl md:text-8xl">
            It never trusts.
            <br />
            <span className="text-argus-accent">So you can.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-lg text-lg text-argus-dim">
            The party that proposes a trade is never the party that authorises it.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link href="/proof" className="btn-primary">
              Watch it refuse, live
              <span aria-hidden>→</span>
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="btn-ghost">
              Read the code
            </a>
          </div>
        </Reveal>
      </section>
    </>
  );
}
