// ─────────────────────────────────────────────────────────────────
// WHITE-LABEL CONFIG — all branding lives here.
// To rebrand: edit this file + swap /public/logo.svg. Nothing else.
// The full colour palette (tints, shades, ink) is derived
// automatically from primaryColor + accentColor in lib/theme.ts.
// ─────────────────────────────────────────────────────────────────

export const brand = {
  name: "ShifaPK",
  tagline: "Cellular wellness, done properly.",
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
    shippingLine: "Every order packed and shipped by us, worldwide.",
    qualityLine: "NovaCert Certificate of Analysis on every product, purity verified at ≥99.9%.",
    secureLine: "Crypto payments processed securely via NOWPayments.",
  },
  // AED-to-X multipliers used to display affiliate balances in their chosen
  // payout currency. Update these whenever rates drift materially.
  // Actual payout conversion is handled by your bank at the time of transfer.
  aedRates: {
    AED: 1,
    PKR: 76.5,
    USD: 0.272,
    GBP: 0.215,
    EUR: 0.250,
  } as Record<string, number>,
  // Slugs that get a "Best Seller" badge on product cards
  bestSellers: [
    "retatrutide-pen",
    "bptb-repair-pen",
    "nd1000-nad-cellular-energy-pen",
  ],
};

export type Currency = (typeof brand.currency.supported)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  AED: "AED",
  PKR: "Rs",
  USD: "$",
  GBP: "£",
  EUR: "€",
};

/** Convert an AED amount to any supported currency using the configured indicative rates. */
export function convertFromAed(aedAmount: number | string, to: Currency): number {
  const n = typeof aedAmount === "string" ? parseFloat(aedAmount) : aedAmount;
  const rate = brand.aedRates[to] ?? 1;
  return Math.round(n * rate * 100) / 100;
}

export function formatPrice(amount: number | string, currency: Currency): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOLS[currency]} ${formatted}`;
}

/** Affiliate amounts are tracked and paid in USDT (TRC20). */
export function formatUsdt(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} USDT`;
}
