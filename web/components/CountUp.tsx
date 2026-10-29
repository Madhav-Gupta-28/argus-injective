"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated count-up. Parses the numeric core out of a display string
 * (e.g. "$1,530", "+671 bps", "#1", "2") and tweens it from zero to target
 * once it scrolls into view, preserving prefix/suffix and comma grouping.
 * Falls back to the final value instantly under prefers-reduced-motion.
 */
export function CountUp({
  value,
  durationMs = 1200,
  className = "",
}: {
  value: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState<string>(() => skeleton(value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const parsed = parse(value);
    if (!parsed) {
      setDisplay(value);
      return;
    }
    const { prefix, target, suffix, decimals, grouped } = parsed;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    let startTs = 0;
    const run = () => {
      const tick = (ts: number) => {
        if (!startTs) startTs = ts;
        const p = Math.min(1, (ts - startTs) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        const current = target * eased;
        setDisplay(format(prefix, current, suffix, decimals, grouped));
        if (p < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setDisplay(value); // snap to the exact source string at the end
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

interface Parsed {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean;
}

function parse(value: string): Parsed | null {
  const m = value.match(/-?[\d,]*\.?\d+/);
  if (!m) return null;
  const numStr = m[0];
  const start = m.index ?? 0;
  const prefix = value.slice(0, start);
  const suffix = value.slice(start + numStr.length);
  const target = Number(numStr.replace(/,/g, ""));
  if (!Number.isFinite(target)) return null;
  const dot = numStr.indexOf(".");
  const decimals = dot === -1 ? 0 : numStr.length - dot - 1;
  return { prefix, suffix, target, decimals, grouped: numStr.includes(",") };
}

function format(prefix: string, n: number, suffix: string, decimals: number, grouped: boolean): string {
  const num = grouped
    ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals);
  return `${prefix}${num}${suffix}`;
}

/** A zeroed placeholder so SSR/first paint matches the eventual width. */
function skeleton(value: string): string {
  const p = parse(value);
  if (!p) return value;
  return format(p.prefix, 0, p.suffix, p.decimals, p.grouped);
}
