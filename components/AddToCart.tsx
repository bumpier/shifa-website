"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { formatPrice } from "@/config/brand";
import type { Currency } from "@/config/brand";
import type { ProductVariant } from "@/lib/product-utils";

function variantPriceMap(v: ProductVariant): Record<Currency, string> {
  return {
    AED: String(v.priceAed),
    PKR: String(v.pricePkr),
    USD: String(v.priceUsd),
    GBP: String(v.priceGbp),
    EUR: String(v.priceEur),
  };
}

export function AddToCart({
  productId,
  slug,
  name,
  image,
  prices,
  inStock,
  variants,
}: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  prices: Record<Currency, string>;
  inStock: boolean;
  variants?: ProductVariant[];
}) {
  const { add } = useCart();
  const { currency } = useCurrency();
  const hasVariants = variants && variants.length > 0;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants ? variants[0] : null
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const activePrices = selectedVariant ? variantPriceMap(selectedVariant) : prices;

  if (!inStock) {
    return (
      <button className="btn-primary w-full sm:w-auto" disabled>
        Out of stock
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {hasVariants && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft">
            Dosage
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.label}
                type="button"
                onClick={() => setSelectedVariant(v)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  selectedVariant?.label === v.label
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink hover:border-brand/40"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-2xl font-semibold text-brand">
            {formatPrice(activePrices[currency] ?? "0", currency)}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-11 w-11 rounded-l-full text-lg text-ink-soft hover:text-brand"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(50, q + 1))}
            className="h-11 w-11 rounded-r-full text-lg text-ink-soft hover:text-brand"
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="btn-primary flex-1 sm:flex-none"
          onClick={() => {
            const label = selectedVariant?.label;
            add(
              {
                productId,
                slug,
                name: label ? `${name} (${label})` : name,
                image,
                prices: activePrices,
                variantLabel: label,
              },
              qty
            );
            setAdded(true);
            setTimeout(() => setAdded(false), 1600);
          }}
        >
          {added ? "Added ✓" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
