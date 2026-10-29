import type { Metadata } from "next";
import { SectionLabel, StatusPill, Card } from "@/components/ui";
import { Reveal } from "@/components/Reveal";
import { LiveProof } from "@/components/LiveProof";
import { Deployed } from "@/components/Deployed";
import { Terminal, T } from "@/components/Terminal";
import { ARGUS, AGENT, REFUSAL_TX, REFUSAL_BLOCK, REPO, txUrl } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Live proof — Argus on Injective",
  description:
    "Five proposals put to the deployed contract from your browser, a refusal already mined on-chain, and the command to reproduce it yourself.",
};

export default function Proof() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Live proof</SectionLabel>
            <h1 className="mt-5 font-display text-5xl leading-[0.98] tracking-tight text-argus-ink sm:text-6xl">
              Don&apos;t take the <span className="text-argus-accent">page&apos;s word for it.</span>
            </h1>
          </div>
          <StatusPill tone="good">Injective EVM testnet</StatusPill>
        </div>
        <p className="mt-6 max-w-2xl text-lg text-argus-dim">
          Three kinds of evidence, in increasing order of how hard they are to fake: calls your own
          browser makes, a transaction already mined, and a command you can run without trusting
          anything here.
        </p>
      </section>

      {/* ---------------- 1. live calls ---------------- */}
      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <Reveal>
          <h2 className="font-display text-3xl tracking-tight text-argus-ink">
            <span className="stat-num mr-3 text-argus-accent">01</span>
            Five proposals, answered by the contract
          </h2>
          <p className="mt-3 max-w-2xl text-argus-dim">
            The owner published a mandate and its signature. Your browser puts five orders to{" "}
            <span className="font-mono text-[13.5px]">preflight</span> on the deployed contract and
            prints what comes back. The oracle price is read through Argus, from precompile{" "}
            <span className="font-mono text-[13.5px]">0x…0067</span>, on every run.
          </p>
        </Reveal>
        <Reveal className="mt-8">
          <LiveProof />
        </Reveal>
        <p className="mt-4 max-w-2xl text-sm text-argus-faint">
          Publishing a mandate signature grants nothing. Placing an order requires the caller to be
          the mandate&apos;s agent, these are view calls that take no authority at all, and the
          mandate is capped at $10,000 of lifetime notional on a single market.
        </p>
      </section>

      {/* ---------------- 2. mined ---------------- */}
      <div className="border-y border-argus-line bg-argus-tint">
        <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <Reveal>
            <h2 className="font-display text-3xl tracking-tight text-argus-ink">
              <span className="stat-num mr-3 text-argus-accent">02</span>
              A refusal that cost real gas
            </h2>
            <p className="mt-3 max-w-2xl text-argus-dim">
              A refusal that only ever appears in a view call is easy to wave away. This one is a
              real transaction, signed by the agent&apos;s own key, that the contract reverted.
            </p>
          </Reveal>

          <Reveal className="mt-8">
            <Card className="p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-argus-faint">
                  block {REFUSAL_BLOCK.toLocaleString("en-US")}
                </span>
                <a
                  href={txUrl(REFUSAL_TX)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12.5px] text-argus-accent hover:underline"
                >
                  verify on Blockscout →
                </a>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-argus-line bg-argus-line lg:grid-cols-4">
                {[
                  { k: "Asked for", v: "−10.00%", s: "below the oracle", tone: "red" },
                  { k: "Band signed", v: "±1.00%", s: "100 bps", tone: "ink" },
                  { k: "Revert", v: "OutsideBand", s: "(1000, 100)", tone: "red" },
                  { k: "Reached the CLOB", v: "No", s: "refused first", tone: "green" },
                ].map((t) => (
                  <div key={t.k} className="bg-argus-card p-5">
                    <div className="font-mono text-[10.5px] uppercase tracking-wider text-argus-faint">
                      {t.k}
                    </div>
                    <div
                      className={`stat-num mt-2 text-2xl font-semibold ${
                        t.tone === "green"
                          ? "text-argus-accent"
                          : t.tone === "red"
                            ? "text-argus-red"
                            : "text-argus-ink"
                      }`}
                    >
                      {t.v}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-argus-dim">{t.s}</div>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-argus-dim">
                <span className="font-mono text-[13px] text-argus-ink">0xe3a504e8</span> is the
                selector for{" "}
                <span className="font-mono text-[13px]">OutsideBand(uint256,uint256)</span>. The
                agent asked to trade 10% away from the oracle; the owner had signed 1%.
              </p>
            </Card>
          </Reveal>
        </section>
      </div>

      {/* ---------------- 3. reproduce ---------------- */}
      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
        <Reveal>
          <h2 className="font-display text-3xl tracking-tight text-argus-ink">
            <span className="stat-num mr-3 text-argus-accent">03</span>
            Reproduce it without trusting this page
          </h2>
          <p className="mt-3 max-w-2xl text-argus-dim">
            Replay that transaction as a call against the block it was mined in. The node runs the
            precompile and hands back the reason. No key, no indexer, no server.
          </p>
        </Reveal>

        <Reveal className="mt-8">
          <Terminal header="foundry · cast">
            {"INJ=https://k8s.testnet.json-rpc.injective.network/\n\n"}
            {T.hl("cast call ")}
            {ARGUS}
            {" \\\n  --data $(cast tx "}
            {`${REFUSAL_TX.slice(0, 12)}…`}
            {" input --rpc-url $INJ) \\\n  --from "}
            {AGENT}
            {" \\\n  --block "}
            {String(REFUSAL_BLOCK)}
            {" --rpc-url $INJ\n\n"}
            {T.no("execution reverted, data: 0xe3a504e8")}
            {"\n  …03e8   "}
            {T.warn("deviation = 1000 bps")}
            {"\n  …0064   "}
            {T.warn("band      =  100 bps")}
          </Terminal>
        </Reveal>

        <Reveal className="mt-8">
          <Card className="p-7">
            <h3 className="font-display text-xl text-argus-ink">Or run the whole thing</h3>
            <p className="mt-2 text-sm text-argus-dim">
              43 tests pass from a clean clone; eight of them read live prices straight from an
              Injective node mid-test.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-xl border border-argus-line bg-argus-bg p-5 font-mono text-[12.5px] leading-relaxed text-argus-dim">
{`git clone ${REPO.replace("https://", "")}
cd argus-injective && forge test

cd agent && npm install && npm run demo`}
            </pre>
          </Card>
        </Reveal>
      </section>

      {/* ---------------- the recording ---------------- */}
      <div className="border-y border-argus-line bg-argus-tint">
        <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
          <Reveal>
            <h2 className="font-display text-3xl tracking-tight text-argus-ink">
              The same run, recorded
            </h2>
            <p className="mt-3 max-w-2xl text-argus-dim">
              Unedited: the test suite, then six orders put to the deployed contract, then a refused
              order broadcast so the revert is mined.
            </p>
          </Reveal>
          <Reveal className="mt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/demo.gif"
              alt="Terminal recording of Argus refusing five orders and allowing one against Injective testnet"
              className="w-full rounded-2xl border border-argus-line bg-black shadow-lift"
            />
          </Reveal>
        </section>
      </div>

      {/* ---------------- deployed + status ---------------- */}
      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
        <Reveal>
          <h2 className="font-display text-3xl tracking-tight text-argus-ink">Deployed</h2>
        </Reveal>
        <Reveal className="mt-6">
          <Deployed />
        </Reveal>

        <Reveal className="mt-10">
          <Card className="border-argus-amber/25 bg-argus-amber/[0.04] p-7">
            <div className="font-mono text-[10.5px] uppercase tracking-label text-argus-amber">
              What does not work yet
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-argus-dim">
              No order has been <em>filled</em>. The contract&apos;s exchange subaccount holds no
              USDC margin and the testnet BTC book currently has no asks, so an accepted order is
              handed to the exchange module and declined{" "}
              <span className="font-medium text-argus-ink">there</span> — by the market, not by
              Argus. The demo prints that distinction rather than hiding it. Funding the subaccount
              and posting a resting limit order is the next commit.
            </p>
          </Card>
        </Reveal>
      </section>
    </>
  );
}
