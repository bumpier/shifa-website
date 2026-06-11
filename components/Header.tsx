"use client";

import Link from "next/link";
import { brand, type Currency } from "@/config/brand";
import { useCart } from "@/components/CartProvider";
import { useCurrency } from "@/components/CurrencyProvider";

export function Header({ signedIn }: { signedIn: boolean }) {
  const { count, hydrated } = useCart();
  const { currency, setCurrency } = useCurrency();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt="" className="h-9 w-9" />
          <span className="font-display text-xl font-semibold tracking-tight text-brand-deep">
            {brand.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft sm:flex">
          <Link href="/products" className="transition-colors hover:text-brand">
            Shop
          </Link>
          <Link
            href={signedIn ? "/dashboard" : "/auth/login"}
            className="transition-colors hover:text-brand"
          >
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="currency-select">
            Currency
          </label>
          <select
            id="currency-select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
          >
            {brand.currency.supported.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Mobile-only Shop link */}
          <Link
            href="/products"
            className="text-sm font-medium text-ink-soft hover:text-brand sm:hidden"
            aria-label="Shop"
          >
            Shop
          </Link>

          <Link
            href="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition-colors hover:border-brand"
            aria-label={`Cart, ${count} items`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-deep">
              <path d="M6 7h12l-1.2 11.2a1.6 1.6 0 0 1-1.6 1.4H8.8a1.6 1.6 0 0 1-1.6-1.4L6 7Z" strokeLinejoin="round" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" strokeLinecap="round" />
            </svg>
            {hydrated && count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
