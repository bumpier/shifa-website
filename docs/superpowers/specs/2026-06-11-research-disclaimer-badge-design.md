# Research Disclaimer Badge — Design Spec

**Date:** 2026-06-11

## Goal

Add a "For research purposes only" badge overlaid on the product image on both the product card and the full product page.

## Badge Appearance

- Text: `For research purposes only`
- Position: `absolute bottom-2 left-2` inside the image container
- Styles: `bg-black/60 text-white text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm`

## Changes

### 1. `components/ProductCard.tsx`
- Add `relative` to the `aspect-square` image wrapper div
- Add badge element inside the wrapper, after `<ProductImage />`

### 2. `app/(store)/products/[slug]/page.tsx`
- Add `relative` to the `aspect-square` image wrapper div
- Add badge element inside the wrapper, after `<ProductImage />`

## Out of Scope
- No changes to cart, checkout, or any other page
- No `brand.ts` config entry for the disclaimer text (hardcoded — it's a legal label, not a brand string)
