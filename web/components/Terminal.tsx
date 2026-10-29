import type { ReactNode } from "react";

/**
 * A dark "diagram" terminal — the dramatic proof block in the Tally spirit.
 * Always dark, in both themes, so it reads as a machine speaking. Compose the
 * body with the exported <T.*> line helpers for consistent semantic colors.
 */
export function Terminal({
  header,
  children,
  className = "",
}: {
  header: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-white/10 bg-[#0b0f0d] p-6 font-mono text-[13.5px] leading-[1.9] text-[#98a49d] shadow-lift ${className}`}
    >
      <div className="mb-3.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#5b6a62]">
        <span className="h-2 w-2 rounded-full bg-[#4ade80]" style={{ boxShadow: "0 0 8px #4ade80" }} />
        {header}
      </div>
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  );
}

/** Semantic inline spans for terminal content. */
export const T = {
  ok: (c: ReactNode) => <span className="text-[#4ade80]">{c}</span>,
  no: (c: ReactNode) => <span className="text-[#f87171]">{c}</span>,
  warn: (c: ReactNode) => <span className="text-[#fbbf24]">{c}</span>,
  hl: (c: ReactNode) => <span className="text-[#e8f2ec]">{c}</span>,
  big: (c: ReactNode) => <span className="text-[15px] text-[#e8f2ec]">{c}</span>,
};
