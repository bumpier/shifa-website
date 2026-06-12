"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { brand, formatPrice, type Currency } from "@/config/brand";

type Method = "card" | "jazzcash" | "easypaisa" | "btc" | "eth" | "usdt" | "xmr";

const METHODS: { id: Method; label: string; hint: string; badge: string; discount?: boolean }[] = [
  { id: "card", label: "Card", hint: "Visa / Mastercard, AED, USD, GBP or PKR", badge: "💳" },
  { id: "jazzcash", label: "JazzCash", hint: "Pakistani mobile wallet, paid in PKR", badge: "🟠" },
  { id: "easypaisa", label: "Easypaisa", hint: "Pakistani mobile wallet, paid in PKR", badge: "🟢" },
  { id: "btc", label: "Bitcoin", hint: "BTC with 10% discount", badge: "₿", discount: true },
  { id: "eth", label: "Ethereum", hint: "ETH with 10% discount", badge: "Ξ", discount: true },
  { id: "usdt", label: "USDT", hint: "Tether stablecoin with 10% discount", badge: "💵", discount: true },
  { id: "xmr", label: "Monero", hint: "XMR with 10% discount - private transactions", badge: "🔐", discount: true },
];

export default function CheckoutPage() {
  // useSearchParams needs a Suspense boundary for static prerender
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}

function CheckoutForm() {
  const { items, hydrated, clear } = useCart();
  const { currency } = useCurrency();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";

  const [method, setMethod] = useState<Method>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCrypto = ["btc", "eth", "usdt", "xmr"].includes(method);

  // For crypto, always show USD; for wallets, use PKR; for cards, use selected currency
  const chargeCurrency: Currency = isCrypto ? "USD" : method === "card" ? currency : "PKR";
  const total = items.reduce(
    (sum, i) => sum + parseFloat(i.prices[chargeCurrency] ?? "0") * i.qty,
    0
  );

  // Apply 10% discount for crypto
  const discountedTotal = isCrypto ? total * 0.9 : total;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          addressLine1: form.get("addressLine1"),
          addressLine2: form.get("addressLine2") ?? "",
          city: form.get("city"),
          country: form.get("country"),
          postalCode: form.get("postalCode") ?? "",
          currency: chargeCurrency,
          paymentMethod: method,
          items: items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      clear();
      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-3xl font-medium text-brand-deep">Checkout</h1>
        <p className="mt-4 text-ink-soft">Your cart is empty.</p>
        <Link href="/products" className="btn-primary mt-8">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Almost there</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-brand-deep">
        Checkout
      </h1>

      {cancelled && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Payment was cancelled. Your order has not been placed. You can try again below.
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <fieldset className="card p-6">
            <legend className="sr-only">Contact details</legend>
            <p className="eyebrow mb-5">1 · Contact</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" name="name" required minLength={2} maxLength={100} className="field" autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required maxLength={254} className="field" autoComplete="email" spellCheck={false} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" required pattern="^\+?[0-9\s\-]{7,20}$" placeholder="+971 50 123 4567" className="field" autoComplete="tel" spellCheck={false} />
              </div>
            </div>
          </fieldset>

          <fieldset className="card p-6">
            <legend className="sr-only">Shipping address</legend>
            <p className="eyebrow mb-5">2 · Shipping address</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="addressLine1">Address line 1</label>
                <input id="addressLine1" name="addressLine1" required minLength={5} maxLength={200} className="field" autoComplete="address-line1" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="addressLine2">Address line 2 (optional)</label>
                <input id="addressLine2" name="addressLine2" maxLength={200} className="field" autoComplete="address-line2" />
              </div>
              <div>
                <label className="label" htmlFor="city">City</label>
                <input id="city" name="city" required minLength={2} maxLength={100} className="field" autoComplete="address-level2" />
              </div>
              <div>
                <label className="label" htmlFor="country">Country</label>
                <input id="country" name="country" required minLength={2} maxLength={100} className="field" autoComplete="country-name" />
              </div>
              <div>
                <label className="label" htmlFor="postalCode">Postal code (optional)</label>
                <input id="postalCode" name="postalCode" maxLength={20} className="field" autoComplete="postal-code" />
              </div>
            </div>
          </fieldset>

          <fieldset className="card p-6">
            <legend className="sr-only">Payment method</legend>
            <p className="eyebrow mb-5">3 · Payment method</p>
            <div className="space-y-3">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                    method === m.id
                      ? "border-brand bg-brand-tint"
                      : "border-line bg-white hover:border-brand/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                    className="h-4 w-4 accent-[rgb(var(--brand))]"
                  />
                  <span className="text-xl" aria-hidden>{m.badge}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink">{m.label}</span>
                    <span className="block text-xs text-ink-soft">{m.hint}</span>
                  </span>
                  {m.discount && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      -10%
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Order summary */}
        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <p className="eyebrow mb-5">Order summary</p>
          <ul className="space-y-3 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="text-ink-soft">
                  {i.name} <span className="text-ink-soft/60">× {i.qty}</span>
                </span>
                <span className="font-medium">
                  {formatPrice(parseFloat(i.prices[chargeCurrency] ?? "0") * i.qty, chargeCurrency)}
                </span>
              </li>
            ))}
          </ul>

          {isCrypto && (
            <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <span className="font-semibold">10% crypto discount applied!</span>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
            {isCrypto && total !== discountedTotal && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Subtotal</span>
                <span className="text-ink-soft">{formatPrice(total, chargeCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-semibold text-ink">{isCrypto ? "Total after discount" : "Total"}</span>
              <span className="font-semibold text-brand-deep">
                {formatPrice(discountedTotal, chargeCurrency)}
              </span>
            </div>
          </div>

          {!isCrypto && method !== "card" && currency !== "PKR" && (
            <p className="mt-3 text-xs text-ink-soft">
              {METHODS.find((m) => m.id === method)?.label} payments settle in PKR.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={submitting || !hydrated} className="btn-primary mt-6 w-full">
            {submitting ? "Redirecting to payment…" : "Pay securely"}
          </button>
          <p className="mt-4 text-center text-xs text-ink-soft/70">
            🔒 {brand.trust.secureLine}
          </p>
        </aside>
      </form>
    </div>
  );
}
