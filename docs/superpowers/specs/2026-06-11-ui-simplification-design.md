---
title: UI Simplification for Low-End Phones & Poor Internet
date: 2026-06-11
status: approved
---

## Goal

Simplify the storefront UI so it loads fast and is easy to use on low-end Android phones with poor internet connectivity. Keep the green palette and brand aesthetic — remove only the decorative layer that causes GPU work and visual noise.

## Scope

Store-facing pages only (`app/(store)/`, `components/`, `app/globals.css`, `tailwind.config.ts`). Admin panel is out of scope.

---

## Changes

### 1. Fonts
Keep Inter (Google Fonts). No change.

### 2. Visual effects — removed

**`app/globals.css`**
- Remove `.rise` keyframe animation and all `.rise`, `.rise-1` through `.rise-4` classes
- Remove `.grain::before` CSS texture overlay
- Remove the `@media (prefers-reduced-motion)` block (only contained a `.rise` override — no longer needed)
- Keep print styles unchanged (`.grain::before { display: none }` in print block can also be removed since the class is gone)

**`app/layout.tsx`**
- Remove `grain` from the `<body>` className

**`app/(store)/page.tsx` — Hero section**
- Remove the two decorative `<div aria-hidden>` blobs with `blur-3xl`
- Remove `rise rise-1` through `rise rise-4` classNames from hero children

**`components/Header.tsx`**
- Replace `bg-paper/90 backdrop-blur-sm` with `bg-paper` (solid background)

**`components/ProductCard.tsx`**
- Remove `hover:shadow-lift` from the card link
- Remove `transition-transform duration-500 group-hover:scale-[1.04]` from the image

**`app/(store)/page.tsx` — Reassurance strip button**
- Remove `transition-transform hover:scale-[1.02]` from the "Browse products" button

### 3. Card & button style simplification

**`app/globals.css`**
- `.card`: change `rounded-2xl` → `rounded-xl`, `shadow-card` → `shadow-sm`
- `.btn-primary`: change `rounded-full` → `rounded-lg`, add `min-h-[44px]`, remove `hover:shadow-lift`
- `.btn-secondary`: change `rounded-full` → `rounded-lg`, add `min-h-[44px]`

**`tailwind.config.ts`** — no changes needed. `shadow-lift` stays: it is still used in `app/admin/page.tsx`.

### 4. Hero padding

**`app/(store)/page.tsx`**
- Hero section: `py-20 sm:py-28` → `py-12 sm:py-20`

### 5. Mobile navigation

**`components/Header.tsx`**
- Add a "Shop" `<Link href="/products">` next to the cart icon, visible only on mobile (shown below `sm:`, hidden at `sm:` and above where the full nav already appears)
- Style: plain text link, `text-sm font-medium text-ink-soft`, same tap target height as cart button

---

## Files Changed

| File | Change |
|---|---|
| `app/globals.css` | Remove `.rise` animation, `.grain` texture; simplify `.card`, `.btn-primary`, `.btn-secondary` |
| `app/layout.tsx` | Remove `grain` class from `<body>` |
| `app/(store)/page.tsx` | Remove hero blobs, remove `.rise` classes, reduce hero padding, remove button scale hover |
| `components/Header.tsx` | Solid header background, add mobile "Shop" link |
| `components/ProductCard.tsx` | Remove image hover scale and card hover shadow |

---

## Out of Scope

- Performance layer (image `sizes`, static caching, JS bundle optimisation) — deferred to a separate pass
- Admin panel UI
- Any changes to checkout logic or payment flow
