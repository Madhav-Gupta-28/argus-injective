/**
 * Argus mark — a guardian's shield with a watchful eye. Shield = protection,
 * eye = the all-seeing watchman. Theme-aware (ink shield, emerald eye) and
 * legible down to nav size. `live` gives the iris a gentle pulse.
 */
export function EyeMark({
  size = 28,
  live = false,
  className = "",
}: {
  size?: number;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
        {/* shield body */}
        <path
          d="M7 5 H25 Q26 5 26 6 V15.5 Q26 22.4 16 28.7 Q6 22.4 6 15.5 V6 Q6 5 7 5 Z"
          style={{ fill: "rgb(var(--argus-ink))" }}
        />
        {/* top sheen for a crafted, non-flat feel */}
        <path
          d="M7 5 H25 Q26 5 26 6 V8.2 H6 V6 Q6 5 7 5 Z"
          style={{ fill: "rgb(var(--argus-accentBright))" }}
          opacity="0.16"
        />
        {/* eye outline */}
        <path
          d="M9.4 14 Q16 9.5 22.6 14 Q16 18.5 9.4 14 Z"
          style={{ stroke: "rgb(var(--argus-accentBright))" }}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* iris + pupil */}
        <circle
          cx="16"
          cy="14"
          r="2.7"
          style={{ fill: "rgb(var(--argus-accentBright))" }}
          className={live ? "animate-pulse" : ""}
        />
        <circle cx="16" cy="14" r="1" style={{ fill: "rgb(var(--argus-ink))" }} />
      </svg>
    </span>
  );
}
