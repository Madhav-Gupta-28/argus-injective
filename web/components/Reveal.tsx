"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper. Adds `is-visible` (see `.reveal` in globals.css) the
 * first time the element enters the viewport, then stops observing. Respects
 * prefers-reduced-motion by revealing immediately.
 */
export function Reveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const t = window.setTimeout(() => el.classList.add("is-visible"), delayMs);
            io.disconnect();
            return () => window.clearTimeout(t);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delayMs]);

  const Comp = Tag as "div";
  return (
    <Comp ref={ref as React.Ref<HTMLDivElement>} className={`reveal ${className}`}>
      {children}
    </Comp>
  );
}
