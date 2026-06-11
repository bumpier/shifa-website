# UI Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip GPU-heavy visual effects and improve mobile usability so the storefront loads fast and is easy to use on low-end phones with poor internet.

**Architecture:** Pure CSS/JSX changes across 5 files — no logic, no data model, no API changes. Each task is self-contained and independently committable.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v3, React 19

---

## Files Changed

| File | What changes |
|---|---|
| `app/globals.css` | Remove `.rise` animation + `.grain` texture; simplify `.card`, `.btn-primary`, `.btn-secondary` |
| `app/layout.tsx` | Remove `grain` class from `<body>` |
| `app/(store)/page.tsx` | Remove hero blobs + `.rise` classes, reduce hero padding, remove button scale hover |
| `components/Header.tsx` | Solid background (no backdrop-blur), add mobile "Shop" link |
| `components/ProductCard.tsx` | Remove image hover scale and card hover shadow transition |

---

### Task 1: Strip animations and grain from `globals.css` and `layout.tsx`

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the full contents of `app/globals.css`**

  Remove: `.rise` keyframe + classes, `.grain::before` block, `@media (prefers-reduced-motion)` block (it only contained a `.rise` override). Also remove `.grain::before { display: none }` from the print block. No other changes yet.

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  @layer base {
    body {
      @apply bg-paper text-ink antialiased;
      font-feature-settings: "ss01" on, "cv11" on;
    }

    ::selection {
      @apply bg-brand text-white;
    }
  }

  @layer components {
    .eyebrow {
      @apply text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand;
    }

    .btn-primary {
      @apply inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-deep hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50;
    }

    .btn-secondary {
      @apply inline-flex items-center justify-center gap-2 rounded-full border border-brand/30 bg-transparent px-6 py-3 text-sm font-semibold text-brand transition-all duration-200 hover:border-brand hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50;
    }

    .field {
      @apply w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-paper;
    }

    .card {
      @apply rounded-2xl border border-line bg-white shadow-card;
    }

    .label {
      @apply mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft;
    }
  }

  /* Print styles — packing slips render clean with no chrome */
  @media print {
    body { background: white !important; }
    .no-print { display: none !important; }
    .print-area {
      box-shadow: none !important;
      border: none !important;
    }
  }
  ```

- [ ] **Step 2: Remove `grain` from `<body>` in `app/layout.tsx`**

  Change line 22 from:
  ```tsx
  <body className="grain font-sans">{children}</body>
  ```
  To:
  ```tsx
  <body className="font-sans">{children}</body>
  ```

- [ ] **Step 3: Run the dev server and verify**

  ```bash
  npm run dev
  ```

  Open `http://localhost:3000`. The page should load without any grain texture on the background. The homepage hero text should appear immediately (no staggered fade-in). No visual regressions elsewhere.

- [ ] **Step 4: Commit**

  ```bash
  git add app/globals.css app/layout.tsx
  git commit -m "feat: remove rise animations and grain texture"
  ```

---

### Task 2: Simplify `.card`, `.btn-primary`, `.btn-secondary` styles

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update the three component classes in `app/globals.css`**

  Replace the `@layer components` block (the entire block between `@layer components {` and its closing `}`) with:

  ```css
  @layer components {
    .eyebrow {
      @apply text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand;
    }

    .btn-primary {
      @apply inline-flex items-center justify-center gap-2 rounded-lg min-h-[44px] bg-brand px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50;
    }

    .btn-secondary {
      @apply inline-flex items-center justify-center gap-2 rounded-lg min-h-[44px] border border-brand/30 bg-transparent px-6 py-3 text-sm font-semibold text-brand transition-all duration-200 hover:border-brand hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50;
    }

    .field {
      @apply w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-paper;
    }

    .card {
      @apply rounded-xl border border-line bg-white shadow-sm;
    }

    .label {
      @apply mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft;
    }
  }
  ```

  Changes made:
  - `.btn-primary`: `rounded-full` → `rounded-lg`, added `min-h-[44px]`, removed `hover:shadow-lift`
  - `.btn-secondary`: `rounded-full` → `rounded-lg`, added `min-h-[44px]`
  - `.card`: `rounded-2xl` → `rounded-xl`, `shadow-card` → `shadow-sm`

- [ ] **Step 2: Verify visually**

  With dev server running, check:
  - `http://localhost:3000` — "Shop the range" and "Best sellers" buttons should be rectangular-rounded (not pill-shaped)
  - `http://localhost:3000/products` — product cards should have a smaller corner radius and lighter shadow
  - `http://localhost:3000/checkout` — "Pay securely" button should match

- [ ] **Step 3: Commit**

  ```bash
  git add app/globals.css
  git commit -m "feat: simplify card and button styles for low-end devices"
  ```

---

### Task 3: Simplify the homepage hero

**Files:**
- Modify: `app/(store)/page.tsx`

- [ ] **Step 1: Remove the hero blobs, `.rise` classes, reduce padding, and remove button hover scale**

  The hero `<section>` currently starts at line 44. Replace the entire `{/* Hero */}` section with:

  ```tsx
  {/* Hero */}
  <section>
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      <p className="eyebrow">{brand.name} wellness</p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl font-medium leading-[1.1] tracking-tight text-brand-deep sm:text-6xl">
        {brand.tagline}
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
        A small, carefully chosen range of wellness essentials — shipped
        with care, paid for the way that suits you: card, JazzCash or
        Easypaisa.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/products" className="btn-primary">
          Shop the range
        </Link>
        <Link href="/products" className="btn-secondary">
          Best sellers
        </Link>
      </div>
    </div>
  </section>
  ```

  Changes made:
  - Removed `relative overflow-hidden` wrapper and both `aria-hidden` blob `<div>`s
  - Removed `relative` from the inner div (no longer needed)
  - Removed `rise rise-1` through `rise rise-4` from all hero children
  - `py-20 sm:py-28` → `py-12 sm:py-20`

- [ ] **Step 2: Remove hover scale from the reassurance strip button**

  Find the reassurance strip near the bottom of the file (the `<section>` with `bg-brand`). The "Browse products" link currently has `transition-transform hover:scale-[1.02]` in its className. Remove those two classes:

  ```tsx
  <Link
    href="/products"
    className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-deep"
  >
    Browse products
  </Link>
  ```

- [ ] **Step 3: Verify visually**

  Check `http://localhost:3000`:
  - Hero section should appear immediately with no animation
  - No decorative blobs visible (none expected)
  - Hero has noticeably less vertical whitespace
  - "Browse products" button no longer scales on hover

- [ ] **Step 4: Commit**

  ```bash
  git add "app/(store)/page.tsx"
  git commit -m "feat: simplify homepage hero for faster render"
  ```

---

### Task 4: Simplify the Header

**Files:**
- Modify: `components/Header.tsx`

- [ ] **Step 1: Replace the header element's className and add a mobile Shop link**

  Replace the entire contents of `components/Header.tsx` with:

  ```tsx
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
  ```

  Changes made:
  - `bg-paper/90 backdrop-blur-sm` → `bg-paper` (solid, no GPU composite layer)
  - Added mobile "Shop" link (`sm:hidden`) between currency select and cart icon

- [ ] **Step 2: Verify visually**

  Check `http://localhost:3000` at a narrow viewport (375px wide):
  - Header should be solid white/paper — no blur effect when scrolling
  - A "Shop" text link should be visible next to the cart icon on mobile
  - At desktop width (`sm:` and above), the "Shop" link should be hidden (full nav visible instead)

- [ ] **Step 3: Commit**

  ```bash
  git add components/Header.tsx
  git commit -m "feat: solid header background, add mobile Shop nav link"
  ```

---

### Task 5: Simplify ProductCard hover effects

**Files:**
- Modify: `components/ProductCard.tsx`

- [ ] **Step 1: Remove hover shadow transition and image scale from `ProductCard`**

  Replace the entire contents of `components/ProductCard.tsx` with:

  ```tsx
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
  ```

  Changes made:
  - Removed `transition-shadow duration-300 hover:shadow-lift` from the card `<Link>`
  - Removed `transition-transform duration-500 group-hover:scale-[1.04]` from the image
  - `group` className kept because `group-hover:text-brand-deep` on the heading still uses it

- [ ] **Step 2: Verify visually**

  Check `http://localhost:3000/products`:
  - Hovering a product card should not animate the image or add a shadow
  - The product name should still change colour on hover (that's a CSS color change, not a GPU effect)

- [ ] **Step 3: Commit**

  ```bash
  git add components/ProductCard.tsx
  git commit -m "feat: remove product card hover animations"
  ```

---

## Done

All 5 tasks complete. The storefront now:
- Has no entrance animations or grain texture
- Uses a solid header (no backdrop-blur)
- Has larger tap targets on all buttons (min 44px)
- Has a mobile Shop navigation link
- Has no GPU-composited hover effects on product cards
- Uses lighter card shadows and less aggressive corner rounding
