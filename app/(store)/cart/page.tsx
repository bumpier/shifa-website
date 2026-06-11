"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { formatPrice } from "@/config/brand";
import { ProductImage } from "@/components/ProductImage";

export default function CartPage() {
  const { items, setQty, remove, hydrated } = useCart();
  const { currency } = useCurrency();

  const subtotal = items.reduce(
    (sum, i) => sum + parseFloat(i.prices[currency] ?? "0") * i.qty,
    0
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Your order</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-brand-deep">
        Cart
      </h1>

      {!hydrated ? null : items.length === 0 ? (
        <div className="card mt-10 p-12 text-center">
          <p className="text-ink-soft">Your cart is empty.</p>
          <Link href="/products" className="btn-primary mt-6">
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-10 divide-y divide-line">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-4 py-5">
                <Link
                  href={`/products/${item.slug}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-brand-tint"
                >
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-medium text-ink hover:text-brand-deep"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm font-semibold text-brand">
                    {formatPrice(item.prices[currency] ?? "0", currency)}
                  </p>
                </div>
                <div className="flex items-center rounded-full border border-line bg-white">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQty(item.productId, item.qty - 1)}
                    className="h-9 w-9 rounded-l-full text-ink-soft hover:text-brand"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-semibold">{item.qty}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQty(item.productId, item.qty + 1)}
                    className="h-9 w-9 rounded-r-full text-ink-soft hover:text-brand"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="text-sm text-ink-soft/60 hover:text-red-700"
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-end gap-4 border-t border-line pt-6">
            <p className="text-lg">
              <span className="text-ink-soft">Subtotal: </span>
              <span className="font-semibold text-brand-deep">
                {formatPrice(subtotal, currency)}
              </span>
            </p>
            <p className="text-xs text-ink-soft/70">
              Final pricing is confirmed at checkout in your selected currency.
            </p>
            <Link href="/checkout" className="btn-primary">
              Proceed to checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
