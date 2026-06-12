# Shifa — white-label e-commerce storefront

A self-contained e-commerce site for physical products with a built-in admin
panel, an invite-only affiliate programme, and Paykassma payments (cards,
JazzCash, Easypaisa, multi-currency: AED / PKR / USD / GBP).

Stack: Next.js 15 (App Router) · SQLite via Prisma · Tailwind CSS · Jose + bcrypt · Postal (self-hosted email).

## Quick start

```bash
cp .env.example .env.local      # fill in values (see below)
echo 'DATABASE_URL="file:../data/shifa.db"' > .env   # Prisma CLI reads .env
npm install
npx prisma migrate dev          # creates data/shifa.db
npx prisma db seed              # 4 sample products
npm run dev                     # http://localhost:3000
```

Generate secrets:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
```

`ADMIN_PASSWORD` may be plain (hashed in memory at boot) or a pre-computed
bcrypt hash (`$2…`). Admin panel: `/admin`.

## White-labelling

Everything brand-related lives in **`config/brand.ts`** — name, tagline,
colours, currencies, contact details, packing-slip message. The full colour
palette (tints, shades, ink, paper) is derived automatically from
`primaryColor` + `accentColor`. To rebrand:

1. Edit `config/brand.ts`
2. Replace `public/logo.svg`

Fonts are the one exception (`next/font` needs literal names): swap the two
imports in `app/fonts.ts`.

## Payments (Paykassma)

`lib/paykassma.ts` is the single integration point. Endpoint paths, payload
field names and the webhook signing method follow the standard
hosted-redirect pattern but **must be confirmed against the merchant
documentation Paykassma provides after approval** — set `PAYKASSMA_API_URL`
and credentials in `.env.local`.

**Dev simulator:** with `PAYKASSMA_ENV=sandbox` and no `PAYKASSMA_API_KEY`,
checkout redirects to `/dev/paykassma`, a local stand-in for the hosted
payment page that fires correctly signed webhooks at the real endpoint, so
the whole flow (checkout → webhook → paid order → commission) works locally.
It returns 404 whenever an API key is configured or `PAYKASSMA_ENV=production`.

## Repurchase nudge emails

Products with `supplyDays > 0` (admin → product form) trigger an automatic
"time to restock" email: `orderDate + min(qty × supplyDays) − 4 days`.
Customers who placed a newer order, or who unsubscribed, are skipped; each
order is nudged at most once (enforced by the `EmailLog` unique constraint).
Order confirmation / shipped / delivered emails are sent automatically from
the payment webhooks and the admin status buttons.

Schedule the daily job on the server:

```cron
15 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/nudges
```

## Email setup (Postal, self-hosted)

Transactional emails (verification, password reset, order confirmation, shipped/delivered, nudges) go through a self-hosted [Postal](https://postalserver.io) server via its HTTP API.

1. In the Postal web UI, create a mail server for the site and add your sending domain (set up the SPF/DKIM/return-path DNS records it shows you)
2. Create an **API** credential for that mail server (Mail Server → Credentials → API)
3. Set `POSTAL_URL` (base URL of your Postal install) and `POSTAL_API_KEY` in `.env.local`, and set `EMAIL_FROM` to an address on the sending domain
4. In dev mode with no API key, emails print to the console

## Affiliate programme

- Admin generates a single-use, 48-hour invite at `/admin/affiliates/invite`
- Affiliate registers via the link, verifies email, gets `/dashboard`
- Referral links: `https://yoursite.com/?ref=CODE` → 30-day cookie, last-click wins
- Commissions are created **only** by the payment webhook (order → paid),
  tracked in USDT (calculated from the order's USD subtotal — USDT is
  dollar-pegged), and reviewed (approve/reject) in the admin panel
- Payouts: affiliate requests when balance ≥ `AFFILIATE_MIN_PAYOUT_USDT`;
  admin sends USDT on TRC20 manually within 24–48 hours, records the tx
  hash, and marks paid
- The affiliate's USDT (TRC20) wallet address is AES-256-GCM encrypted at rest

## Useful paths

| Path | Purpose |
|---|---|
| `config/brand.ts` | All branding (white-label) |
| `prisma/schema.prisma` | Database schema |
| `lib/paykassma.ts` | Payment gateway integration |
| `lib/affiliate.ts` | Commission lifecycle |
| `app/admin/*` | Admin panel |
| `data/shifa.db` | SQLite database (never web-accessible) |

## Deployment note

SQLite + local file uploads require a host with a persistent filesystem (a
VPS, Fly.io volume, Railway volume, etc.). On Vercel the filesystem is
ephemeral — to deploy there, swap SQLite for a hosted database (e.g. Neon
Postgres via the Vercel Marketplace: change the Prisma `provider`, keep the
schema) and move uploads to Vercel Blob.

## Pre-launch checklist

See the security checklist in `docs/CLAUDE.md` §12. Already wired in:
security headers, bcrypt admin auth + lockout, Zod validation on every
input, webhook signature verification, UUID order IDs, rate limiting,
generic error responses, httpOnly/sameSite cookies, encrypted wallet addresses.
