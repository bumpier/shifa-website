"use client";

import Link from "next/link";
import { brand, type Currency } from "@/config/brand";
import { useCurrency } from "@/components/CurrencyProvider";

export function Header({ signedIn }: { signedIn: boolean }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt="" className="h-9 w-auto" />
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
        </div>
      </div>
    </header>
  );
}
