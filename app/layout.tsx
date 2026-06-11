import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { brandCssVariables } from "@/lib/theme";
import { bodyFont, displayFont } from "@/app/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s — ${brand.name}`,
  },
  description: brand.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable}`}
      style={brandCssVariables() as React.CSSProperties}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
