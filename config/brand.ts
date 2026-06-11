// ─────────────────────────────────────────────────────────────────
// WHITE-LABEL CONFIG — all branding lives here.
// To rebrand: edit this file + swap /public/logo.svg. Nothing else.
// The full colour palette (tints, shades, ink) is derived
// automatically from primaryColor + accentColor in lib/theme.ts.
// ─────────────────────────────────────────────────────────────────

export const brand = {
  name: "ShifaPK",
  tagline: "Natural wellness, delivered with care",
  logo: "/logo.png", // swap this file to change logo
  primaryColor: "#3ec7ed", // main brand colour
  accentColor: "#121271",
  // Body font is Inter; the display serif is loaded in app/fonts.ts.
  // To change fonts, edit the imports there (next/font needs literal names).
  fontFamily: "Inter",
  currency: {
    default: "PKR" as const,
    supported: ["AED", "PKR", "USD", "GBP", "EUR"] as const,
  },
  contact: {
    email: "hello@shifa.com",
    phone: "+971 XX XXX XXXX",
  },
  // Printed at the bottom of every packing slip
  packingSlipThankYou:
    "Thank you for your order. We hope it brings you good health.",
  trust: {
    shippingLine: "Tracked shipping across UAE, Pakistan & worldwide",
    qualityLine: "Premium quality — every product is carefully selected",
    secureLine: "Secure checkout — cards, JazzCash & Easypaisa",
  },
};

export type Currency = (typeof brand.currency.supported)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  AED: "AED",
  PKR: "Rs",
  USD: "$",
  GBP: "£",
  EUR: "€",
};

export function formatPrice(amount: number | string, currency: Currency): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOLS[currency]} ${formatted}`;
}
