import type { Config } from "tailwindcss";

// All colours resolve to CSS variables injected by app/layout.tsx from
// config/brand.ts — rebranding never requires touching this file.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          tint: "rgb(var(--brand-tint) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
        },
        paper: "rgb(var(--paper) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--ink) / 0.04), 0 8px 24px -12px rgb(var(--ink) / 0.12)",
        lift: "0 2px 4px rgb(var(--ink) / 0.05), 0 16px 40px -16px rgb(var(--ink) / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
