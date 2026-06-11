import type { Currency } from "@/config/brand";
import { brand } from "@/config/brand";
import { cookies } from "next/headers";

export { priceFor, priceMap, parseImages } from "@/lib/product-utils";

export function isCurrency(value: string | undefined | null): value is Currency {
  return !!value && (brand.currency.supported as readonly string[]).includes(value);
}

/** Currency preference from cookie (server components). */
export async function currentCurrency(): Promise<Currency> {
  const c = (await cookies()).get("currency")?.value;
  return isCurrency(c) ? c : brand.currency.default;
}
