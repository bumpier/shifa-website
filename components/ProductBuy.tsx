"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import type { Currency } from "@/config/brand";

export function ProductBuy({
  productId,
  slug,
  name,
  image,
  prices,
  inStock,
  freshaUrl,
}: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  prices: Record<Currency, string>;
  inStock: boolean;
  freshaUrl: string | null;
}) {
  const { buyNow } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);

  function payWithCrypto() {
    buyNow({ productId, slug, name, image, prices }, qty);
    router.push("/checkout");
  }

  return (
    <div className="space-y-4">
      {inStock && (
        <div className="flex items-center rounded-full border border-line bg-white w-fit">
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
      )}

      <div className="flex flex-col gap-3">
        {inStock ? (
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={payWithCrypto}>
            Pay with Crypto
          </button>
        ) : (
          <button type="button" className="btn-primary w-full sm:w-auto" disabled>
            Out of stock
          </button>
        )}

        {freshaUrl && (
          <a
            href={freshaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full sm:w-auto"
          >
            Pay with Fresha
          </a>
        )}
      </div>
    </div>
  );
}
