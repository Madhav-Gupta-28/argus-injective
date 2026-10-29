import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Argus — CSS-variable driven so the same tokens flip between the light
        // "institutional terminal" and the dark variant (see globals.css).
        // Emerald is the brand; red/amber are reserved for genuine risk states.
        argus: {
          bg: "rgb(var(--argus-bg) / <alpha-value>)",
          tint: "rgb(var(--argus-tint) / <alpha-value>)",
          panel: "rgb(var(--argus-panel) / <alpha-value>)",
          card: "rgb(var(--argus-card) / <alpha-value>)",
          line: "var(--argus-line)",
          ink: "rgb(var(--argus-ink) / <alpha-value>)",
          dim: "rgb(var(--argus-dim) / <alpha-value>)",
          faint: "rgb(var(--argus-faint) / <alpha-value>)",
          accent: "rgb(var(--argus-accent) / <alpha-value>)",
          accentBright: "rgb(var(--argus-accentBright) / <alpha-value>)",
          green: "rgb(var(--argus-green) / <alpha-value>)",
          amber: "rgb(var(--argus-amber) / <alpha-value>)",
          red: "rgb(var(--argus-red) / <alpha-value>)",
          // Injective blue — used only for chain chrome (badges, precompile
          // references) so the chain is legible without displacing the brand.
          inj: "rgb(var(--argus-inj) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.22em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(21,20,15,0.04), 0 10px 30px -16px rgba(21,20,15,0.16)",
        lift: "0 2px 4px rgba(21,20,15,0.05), 0 18px 50px -22px rgba(21,20,15,0.22)",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        scan: {
          "0%,100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        ticker: "ticker 30s linear infinite",
        scan: "scan 2.4s ease-in-out infinite",
        riseIn: "riseIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
        sweep: "sweep 5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
