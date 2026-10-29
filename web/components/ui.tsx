import type { ReactNode } from "react";

export function HazardStrip() {
  return <div className="top-rule w-full" />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="label inline-flex items-center gap-2 text-argus-accent">
      <span className="h-px w-5 bg-argus-accent/60" />
      {children}
    </span>
  );
}

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE: Record<Tone, string> = {
  good: "border-argus-green/30 text-argus-green bg-argus-green/8",
  warn: "border-argus-amber/30 text-argus-amber bg-argus-amber/10",
  bad: "border-argus-red/30 text-argus-red bg-argus-red/10",
  neutral: "border-argus-line text-argus-dim bg-argus-ink/[0.03]",
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest ${TONE[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={`panel ${hover ? "panel-hover" : ""} ${className}`}>{children}</div>;
}

export function NumberedStep({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card hover className="p-6">
      <div className="stat-num text-sm font-semibold text-argus-accent">{n}</div>
      <h3 className="mt-3 font-display text-2xl text-argus-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-argus-dim">{children}</p>
    </Card>
  );
}

/** Hover tooltip — wraps an inline trigger and shows a small bubble above it. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex cursor-help items-center">
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-argus-line bg-argus-ink px-3 py-2 text-left text-[11px] normal-case leading-snug tracking-normal text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover/tt:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function InfoDot() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-argus-line text-[9px] font-semibold text-argus-faint">
      ?
    </span>
  );
}
