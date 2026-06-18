"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { brand, formatPrice, type Currency } from "@/config/brand";
import type { PaymentMethodId } from "@/lib/payments/config";

type Coin = "btc" | "eth" | "usdt" | "xmr";

const COINS: { id: Coin; label: string; hint: string; badge: string }[] = [
  { id: "btc", label: "Bitcoin", hint: "BTC", badge: "₿" },
  { id: "eth", label: "Ethereum", hint: "ETH", badge: "Ξ" },
  { id: "usdt", label: "USDT", hint: "Tether stablecoin", badge: "💵" },
  { id: "xmr", label: "Monero", hint: "XMR - private transactions", badge: "🔐" },
];

export function CheckoutForm({ methods }: { methods: PaymentMethodId[] }) {
  const { items, hydrated, clear } = useCart();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";

  const hasCard = methods.includes("card");
  const coins = COINS.filter((c) => methods.includes(c.id));
  const hasCrypto = coins.length > 0;
  const noMethods = methods.length === 0;

  const [payType, setPayType] = useState<"card" | "crypto">(hasCard ? "card" : "crypto");
  const [coin, setCoin] = useState<Coin>(coins[0]?.id ?? "btc");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The storefront always charges in USD (crypto bills the USD subtotal; cards
  // bill the USD order total).
  const chargeCurrency: Currency = "USD";
  const total = items.reduce(
    (sum, i) => sum + parseFloat(i.prices[chargeCurrency] ?? "0") * i.qty,
    0
  );

  // Whether the crypto coin list is shown: both-enabled + crypto chosen, OR crypto-only.
  const showCoins = hasCrypto && (payType === "crypto" || !hasCard);
  const selectedMethod: PaymentMethodId =
    hasCard && (payType === "card" || !hasCrypto) ? "card" : coin;

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
          paymentMethod: selectedMethod,
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

            {noMethods ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Online payment is currently unavailable. Please contact us to place your order.
              </p>
            ) : (
              <div className="space-y-3">
                {/* Top-level Card vs Crypto — only when both are available */}
                {hasCard && hasCrypto && (
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                        payType === "card" ? "border-brand bg-brand-tint" : "border-line bg-white hover:border-brand/40"
                      }`}
                    >
                      <input type="radio" name="payType" checked={payType === "card"} onChange={() => setPayType("card")} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                      <span className="text-xl" aria-hidden>💳</span>
                      <span className="text-sm font-semibold text-ink">Credit / Debit Card</span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                        payType === "crypto" ? "border-brand bg-brand-tint" : "border-line bg-white hover:border-brand/40"
                      }`}
                    >
                      <input type="radio" name="payType" checked={payType === "crypto"} onChange={() => setPayType("crypto")} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                      <span className="text-xl" aria-hidden>🪙</span>
                      <span className="text-sm font-semibold text-ink">Pay with Crypto</span>
                    </label>
                  </div>
                )}

                {/* Card-only: a single informational panel */}
                {hasCard && !hasCrypto && (
                  <div className="flex items-center gap-4 rounded-xl border border-brand bg-brand-tint p-4">
                    <span className="text-xl" aria-hidden>💳</span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-ink">Credit / Debit Card</span>
                      <span className="block text-xs text-ink-soft">Visa, Mastercard, Apple Pay &amp; Google Pay</span>
                    </span>
                  </div>
                )}

                {/* Crypto coin sub-list */}
                {showCoins && (
                  <div className={`space-y-3 ${hasCard ? "mt-2 border-t border-line pt-3" : ""}`}>
                    {coins.map((c) => (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                          coin === c.id ? "border-brand bg-brand-tint" : "border-line bg-white hover:border-brand/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="coin"
                          value={c.id}
                          checked={coin === c.id}
                          onChange={() => setCoin(c.id)}
                          className="h-4 w-4 accent-[rgb(var(--brand))]"
                        />
                        <span className="text-xl" aria-hidden>{c.badge}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-ink">{c.label}</span>
                          <span className="block text-xs text-ink-soft">{c.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
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

          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex justify-between">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-semibold text-brand-deep">
                {formatPrice(total, chargeCurrency)}
              </span>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={submitting || !hydrated || noMethods} className="btn-primary mt-6 w-full">
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
