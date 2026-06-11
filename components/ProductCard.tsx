import Link from "next/link";
import type { Product } from "@prisma/client";
import { formatPrice, type Currency } from "@/config/brand";
import { parseImages, priceFor } from "@/lib/catalog";
import { ProductImage } from "@/components/ProductImage";

export function ProductCard({
  product,
  currency,
}: {
  product: Product;
  currency: Currency;
}) {
  const images = parseImages(product);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="card group block overflow-hidden"
    >
      <div className="aspect-square overflow-hidden bg-brand-tint">
        <ProductImage
          src={images[0] ?? null}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-5">
        <h3 className="font-display text-lg font-medium text-ink group-hover:text-brand-deep">
          {product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand">
            {formatPrice(priceFor(product, currency), currency)}
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
