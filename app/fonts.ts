import { Inter, Fraunces } from "next/font/google";

// next/font requires literal font names, so font swaps for a white-label
// happen here (one import) rather than in config/brand.ts.

export const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});
