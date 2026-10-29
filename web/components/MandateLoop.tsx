/**
 * The mandate loop — the same four-node diamond the Mantle build used for its
 * protection cycle, re-cut for the agent story: the owner signs once, the agent
 * proposes, the contract re-derives the price itself, and only then does
 * anything reach the exchange. Rendered in SVG so it scales and never clips.
 */
const CX = 230;
const CY = 190;
const R = 118;
const NR = 34;

const NODES = [
  { x: CX, y: CY - R, label: "Sign", sub: "once, offline", anchor: "middle", lx: CX, ly: CY - R - NR - 16, icon: pen },
  { x: CX + R, y: CY, label: "Propose", sub: "the agent", anchor: "start", lx: CX + R + NR + 14, ly: CY - 4, icon: bot },
  { x: CX, y: CY + R, label: "Re-derive", sub: "oracle 0x…67", anchor: "middle", lx: CX, ly: CY + R + NR + 22, icon: eye },
  { x: CX - R, y: CY, label: "Decide", sub: "refuse or fill", anchor: "end", lx: CX - R - NR - 14, ly: CY - 4, icon: gavel },
] as const;

export function MandateLoop() {
  return (
    <svg
      viewBox="0 0 460 380"
      className="h-auto w-full max-w-[460px]"
      role="img"
      aria-label="The Argus mandate loop: sign, propose, re-derive, decide."
    >
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="rgb(var(--argus-accent))"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />

      {/* comet travelling the ring */}
      <g>
        <circle cx={CX} cy={CY - R} r="5.5" fill="rgb(var(--argus-accent))" />
        <circle cx={CX - 20.5} cy={CY - 116.2} r="3.5" fill="rgb(var(--argus-accent))" opacity="0.5" />
        <circle cx={CX - 40.4} cy={CY - 110.9} r="2.5" fill="rgb(var(--argus-accent))" opacity="0.25" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${CX} ${CY}`}
          to={`360 ${CX} ${CY}`}
          dur="7s"
          repeatCount="indefinite"
        />
      </g>

      {NODES.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r={NR} fill="rgb(var(--argus-card))" stroke="var(--argus-line)" strokeWidth="1" />
          <g
            transform={`translate(${n.x - 11}, ${n.y - 11})`}
            stroke="rgb(var(--argus-accent))"
            strokeWidth="1.7"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {n.icon()}
          </g>
          <text x={n.lx} y={n.ly} textAnchor={n.anchor} fontSize="15" fontWeight="600" fill="rgb(var(--argus-ink))">
            {n.label}
          </text>
          <text
            x={n.lx}
            y={n.ly + 15}
            textAnchor={n.anchor}
            fontSize="10.5"
            letterSpacing="0.06em"
            fill="rgb(var(--argus-faint))"
            style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)" }}
          >
            {n.sub}
          </text>
        </g>
      ))}

      <text
        x={CX}
        y={CY - 14}
        textAnchor="middle"
        fontSize="10.5"
        letterSpacing="0.16em"
        fill="rgb(var(--argus-faint))"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        ORDERS OUTSIDE
      </text>
      <text
        x={CX}
        y={CY + 22}
        textAnchor="middle"
        fontSize="46"
        fontWeight="600"
        fill="rgb(var(--argus-ink))"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        0
      </text>
      <text
        x={CX}
        y={CY + 42}
        textAnchor="middle"
        fontSize="10.5"
        letterSpacing="0.12em"
        fill="rgb(var(--argus-faint))"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        THE MANDATE
      </text>
    </svg>
  );
}

/* icon path sets, drawn in a 22×22 box */
function pen() {
  return (
    <>
      <path d="M3 19l3-1 11-11-2-2L4 16l-1 3Z" />
      <path d="M15 5l2-2 2 2-2 2" />
    </>
  );
}
function bot() {
  return (
    <>
      <rect x="3" y="7" width="16" height="12" rx="3" />
      <path d="M11 3v4" />
      <circle cx="8" cy="13" r="1.1" />
      <circle cx="14" cy="13" r="1.1" />
    </>
  );
}
function eye() {
  return (
    <>
      <path d="M1 11s3-6 10-6 10 6 10 6-3 6-10 6-10-6-10-6Z" />
      <circle cx="11" cy="11" r="2.5" />
    </>
  );
}
function gavel() {
  return (
    <>
      <path d="M3 19h10" />
      <path d="M6 15l5-5" />
      <rect x="10" y="3" width="8" height="5" rx="1" transform="rotate(45 14 5.5)" />
    </>
  );
}
