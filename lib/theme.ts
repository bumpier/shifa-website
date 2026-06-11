import { brand } from "@/config/brand";

// Derives the full colour system from the two brand hex values so a
// white-label only ever touches config/brand.ts.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  return a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(" ");
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [12, 18, 14];
const PAPER_BASE: [number, number, number] = [251, 249, 244];

export function brandCssVariables(): Record<string, string> {
  const p = hexToRgb(brand.primaryColor);
  const a = hexToRgb(brand.accentColor);
  return {
    "--brand": p.join(" "),
    "--brand-deep": mix(p, BLACK, 0.35),
    "--brand-soft": mix(p, WHITE, 0.82),
    "--brand-tint": mix(p, WHITE, 0.93),
    "--accent": a.join(" "),
    "--accent-soft": mix(a, WHITE, 0.85),
    "--ink": mix(p, BLACK, 0.84),
    "--ink-soft": mix(p, BLACK, 0.55),
    "--paper": mix(p, PAPER_BASE, 0.97),
    "--line": mix(p, WHITE, 0.86),
  };
}
