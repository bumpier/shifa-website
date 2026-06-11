"use client";

import Link from "next/link";
import type { Currency } from "@/config/brand";
import { formatPrice } from "@/config/brand";
import { parseImages } from "@/lib/product-utils";
import { ProductImage } from "@/components/ProductImage";
import { useCurrency } from "@/components/CurrencyProvider";

export interface SerializedProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string;
  stock: number;
  prices: Record<Currency, string>;
}

export function ProductCard({ product }: { product: SerializedProduct }) {
  const { currency } = useCurrency();
const images = parseImages(product);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="card group block overflow-hidden"
    >
      <div className="relative aspect-square overflow-hidden bg-brand-tint">
        <ProductImage
          src={images[0] ?? null}
          alt={product.name}
          className="h-full w-full object-cover"
        />
        <span className="absolute top-2 right-2 rounded-full bg-brand px-2 py-1 text-xs font-medium text-white">
          For research purposes only
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg font-medium text-ink group-hover:text-brand-deep">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-ink-soft line-clamp-2">
          {product.description.split("\n\n")[0]}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand">
            {formatPrice(product.prices[currency], currency)}
          </p>
          {product.stock <= 0 ? (
            <span className="text-xs font-medium text-ink-soft/60">Out of stock</span>
          ) : product.stock <= 5 ? (
            <span className="text-xs font-medium text-amber-700">Only {product.stock} left</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
