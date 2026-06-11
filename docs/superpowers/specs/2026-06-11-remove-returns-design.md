# Remove Returns Policy — Design Spec

**Date:** 2026-06-11  
**Approach:** Silent removal (no explicit "no returns" language)

## Goal

Strip all returns-related copy from the storefront. The store will not advertise or mention returns at all. The "Easy returns" trust badge is replaced with a quality guarantee badge.

## Changes

### 1. `config/brand.ts`
- Rename `trust.returnsLine` → `trust.qualityLine`
- New value: `"Premium quality — every product is carefully selected"`

### 2. `app/(store)/page.tsx`
- Update `TRUST_ITEMS` array:
  - Change title `"Easy returns"` → `"Quality guaranteed"`
  - Change body reference from `brand.trust.returnsLine` → `brand.trust.qualityLine`
  - Replace returns arrow icon (`M4 9l4-4...`) with a quality/star or check icon

### 3. `components/Footer.tsx`
- Remove the `<li>{brand.trust.returnsLine}</li>` entry from the "Our promise" list
- Footer will show two items: secure checkout + tracked shipping

## Out of Scope
- No `/returns` policy page
- No "all sales final" text at checkout or on product pages
- No changes to the privacy page
