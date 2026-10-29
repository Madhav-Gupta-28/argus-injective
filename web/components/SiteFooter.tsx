import { EyeMark } from "./EyeMark";
import { ARGUS, REPO, addressUrl } from "@/lib/chain";

const TICKER = ["SIGN", "PROPOSE", "RE-DERIVE", "REFUSE", "EXECUTE"];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-argus-line">
      <div className="overflow-hidden border-b border-argus-line py-4">
        <div className="flex w-max animate-ticker gap-10 whitespace-nowrap">
          {Array.from({ length: 4 }).flatMap((_, rep) =>
            TICKER.map((t, i) => (
              <span
                key={`${rep}-${i}`}
                className="font-mono text-sm uppercase tracking-label text-argus-faint"
              >
                <span className="text-argus-accent">+</span> {t}
              </span>
            )),
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <EyeMark size={22} />
          <span className="font-display text-lg text-argus-ink">Argus</span>
          <span className="ml-2 font-mono text-[10px] uppercase tracking-label text-argus-faint">
            Injective EVM testnet · v0.1
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-label">
          <a href={REPO} target="_blank" rel="noreferrer" className="link-quiet">
            GitHub
          </a>
          <a href={addressUrl(ARGUS)} target="_blank" rel="noreferrer" className="link-quiet">
            Contract
          </a>
          <span className="text-argus-faint">MIT</span>
        </div>
      </div>
    </footer>
  );
}
