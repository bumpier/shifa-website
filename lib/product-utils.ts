import type { Product } from "@prisma/client";
import type { Currency } from "@/config/brand";

export interface ProductVariant {
  label: string;
  priceAed: number;
  pricePkr: number;
  priceUsd: number;
  priceGbp: number;
  priceEur: number;
}

export function parseVariants(product: Pick<Product, "variants">): ProductVariant[] {
  try {
    const arr = JSON.parse(product.variants ?? "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function variantPriceMap(v: ProductVariant): Record<Currency, string> {
  return {
    AED: String(v.priceAed),
    PKR: String(v.pricePkr),
    USD: String(v.priceUsd),
    GBP: String(v.priceGbp),
    EUR: String(v.priceEur),
  };
}

export function priceForVariant(
  product: Pick<Product, "variants">,
  variantLabel: string,
  currency: Currency
): string | null {
  const v = parseVariants(product).find((x) => x.label === variantLabel);
  if (!v) return null;
  return variantPriceMap(v)[currency];
}

export function priceFor(product: Product, currency: Currency): string {
  switch (currency) {
    case "AED": return product.priceAed.toString();
    case "PKR": return product.pricePkr.toString();
    case "USD": return product.priceUsd.toString();
    case "GBP": return product.priceGbp.toString();
    case "EUR": return (product.priceEur ?? 0).toString();
  }
}

export function priceMap(product: Product): Record<Currency, string> {
  return {
    AED: product.priceAed.toString(),
    PKR: product.pricePkr.toString(),
    USD: product.priceUsd.toString(),
    GBP: product.priceGbp.toString(),
    EUR: (product.priceEur ?? 0).toString(),
  };
}

export function parseImages(product: Pick<Product, "images"> | { images: string }): string[] {
  try {
    const arr = JSON.parse(product.images);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
