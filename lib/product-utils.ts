import type { Product } from "@prisma/client";
import type { Currency } from "@/config/brand";

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

export function parseImages(product: Product): string[] {
  try {
    const arr = JSON.parse(product.images);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
