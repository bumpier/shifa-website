"use client";

import { useCurrency } from "@/components/CurrencyProvider";
import { formatPrice, type Currency } from "@/config/brand";

export function ClientPrice({ prices }: { prices: Record<Currency, string> }) {
  const { currency } = useCurrency();
  return <>{formatPrice(prices[currency], currency)}</>;
}
