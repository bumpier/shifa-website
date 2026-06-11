"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import type { Currency } from "@/config/brand";

export function AddToCart({
  productId,
  slug,
  name,
  image,
  prices,
  inStock,
}: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  prices: Record<Currency, string>;
  inStock: boolean;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!inStock) {
    return (
      <button className="btn-primary w-full sm:w-auto" disabled>
        Out of stock
      </button>
    );
  }

  return (
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
          add({ productId, slug, name, image, prices }, qty);
          setAdded(true);
          setTimeout(() => setAdded(false), 1600);
        }}
      >
        {added ? "Added ✓" : "Add to cart"}
      </button>
    </div>
  );
}
