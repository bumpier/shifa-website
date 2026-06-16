# CLAUDE.md — Shifa E-Commerce Project

## Project Overview
**Shifa** is a simple, trustworthy-looking e-commerce website for selling physical shipped products. It must be easy to white-label (logo, colours, branding swappable with minimal effort). The site includes a self-contained CMS/database for managing orders and printing packing slips, and uses NOWPayments as the payment provider — crypto only (Bitcoin, Ethereum, USDT, Monero), with an automatic 10% discount on every order.

---

## Core Goals
- Clean, trustworthy storefront (not flashy — think pharmacy/wellness aesthetic)
- Easy white-labelling: swap logo, brand name, colours in one config file
- Self-contained: no external CMS dependency — all data stored locally (SQLite)
- Order management dashboard: view orders, print packing slips
- NOWPayments crypto payment integration — Bitcoin, Ethereum, USDT, Monero, with a 10% discount on every order
- Multi-currency product pricing: AED, PKR, USD, GBP (crypto invoices are settled in USD)
- Small catalogue to start: 1–10 physical products
- Invite-only affiliate programme with unique referral links, commission tracking, and affiliate dashboards
- Customer accounts (register/login) so affiliates can log in and track their earnings

---

## Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Simple deploy, good SEO, easy to hand off |
| Database | **SQLite via Prisma** | Self-contained, no external DB server needed |
| Admin/CMS | **Custom admin panel** (built-in) | No third-party CMS dependency |
| Auth | **Jose + bcrypt** | Lightweight JWT, no NextAuth overhead |
| Email | **Postal** (self-hosted) | Transactional email via our own Postal server HTTP API |
| Payments | **NOWPayments** | Crypto only: BTC, ETH, USDT, XMR; hosted invoice + signed IPN webhook |
| Styling | **Tailwind CSS** | Easy to theme via config |
| Deployment | **Vercel** (free tier) | Zero-config, works with Next.js perfectly |

---

## Branding / White-Label System

All branding lives in a single file: `config/brand.ts`

```ts
export const brand = {
  name: "Shifa",
  logo: "/logo.png",           // swap this file to change logo
  primaryColor: "#2D6A4F",     // main brand colour (green as default)
  accentColor: "#74C69D",
  fontFamily: "Inter",
  currency: {
    default: "AED",
    supported: ["AED", "PKR", "USD", "GBP"],
  },
  contact: {
    email: "hello@shifa.com",
    phone: "+971 XX XXX XXXX",
  },
};
```

To white-label for a new client: update `config/brand.ts` + replace `/public/logo.png`. Nothing else needs touching.

---

## Pages & Routes

| Route | Description |
|---|---|
| `/` | Homepage — hero, featured products, trust badges |
| `/products` | Product listing page |
| `/products/[slug]` | Single product page |
| `/cart` | Cart (local state, no login needed) |
| `/checkout` | Checkout form — pay with BTC, ETH, USDT, or XMR via NOWPayments |
| `/order-confirmation/[id]` | Thank you page with order summary |
| `/admin` | Password-protected admin dashboard |
| `/admin/orders` | All orders table |
| `/admin/orders/[id]` | Order detail + packing slip print view |
| `/admin/products` | Add / edit / remove products |
| `/admin/affiliates` | View all affiliates, commission rates, payout status |
| `/admin/affiliates/[id]` | Individual affiliate detail — earnings, referrals, bank info |
| `/admin/affiliates/invite` | Generate & send invite link to a new affiliate |
| `/auth/register` | Registration page (invite token required for affiliates) |
| `/auth/login` | Login page (email + password) |
| `/auth/forgot-password` | Password reset via email |
| `/dashboard` | Affiliate dashboard — referral link, earnings, payout history |

---

## Database Schema (SQLite via Prisma)

### Product
```
id, slug, name, description, price_aed, price_pkr, price_usd, price_gbp,
images[], stock, weight_grams, active, createdAt
```

### Order
```
id, status (pending/paid/shipped/delivered/cancelled),
customerName, customerEmail, customerPhone,
shippingAddress (JSON), items (JSON), currency, totalAmount,
paymentRef, paymentMethod (btc/eth/usdt/xmr), notes, createdAt, updatedAt
```

### User (Affiliate Account)
```
id (UUID), email, passwordHash, role (affiliate),
inviteToken, inviteUsedAt, status (active/suspended),
name, createdAt
```

### AffiliateProfile
```
id, userId (FK), referralCode (unique 8-char slug),
commissionRate (default 10.00, stored as %),
usdtAddress (TRC20, encrypted at rest),
totalEarned, totalPaid, pendingBalance (all USDT), createdAt, updatedAt
```

### AffiliateReferral
```
id, affiliateId (FK), orderId (FK), orderTotal, currency,
commissionRate, commissionAmountUsdt,
status (pending/approved/paid/rejected), createdAt
```

### AffiliateInvite
```
id, token (UUID, unique), createdByAdminAt, usedAt,
usedByUserId (FK nullable), expiresAt (48hr TTL), createdAt
```

### PayoutRequest
```
id, affiliateId (FK), amount, currency (always USDT),
status (requested/processing/paid/rejected),
walletSnapshot (JSON — encrypted wallet address + network at request time),
txHash (TRC20 transaction hash, set when marked paid),
adminNote, requestedAt, processedAt
```

---

## Payment Flow (NOWPayments — crypto only)

Payment is crypto only. Supported coins, each with a 10% discount:
- **Bitcoin (BTC)**
- **Ethereum (ETH)**
- **USDT** — dollar-pegged stablecoin
- **Monero (XMR)** — private transactions

### Checkout Flow
1. Customer fills checkout form and selects a crypto method (BTC / ETH / USDT / XMR)
2. App validates input with Zod server-side
3. App creates a `pending` Order in SQLite with a UUID order ID (10% discount, settled in USD)
4. App calls the NOWPayments Create Invoice API → receives a hosted payment URL
5. Customer is redirected to NOWPayments' hosted page to send crypto
6. On payment: NOWPayments sends a signed IPN webhook to `/api/webhooks/nowpayments`
7. Webhook handler verifies signature, marks the order `paid`, decrements stock and creates the affiliate commission
8. Customer lands on `/order-confirmation/[id]`

### Payment Method Selection UI
At checkout, show the crypto options with their badges, each flagged with the −10% discount:
- ₿ Bitcoin
- Ξ Ethereum
- 💵 USDT
- 🔐 Monero (private)

All crypto invoices are charged in USD (the order's USD subtotal, with the 10% discount applied).

### NOWPayments Integration Notes
- Obtain `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` from https://nowpayments.io/
- Integration follows the standard hosted-invoice + IPN pattern
- IPN webhook signature is HMAC-SHA512 of the raw body, sent in the `X-NOWPAYMENTS-SIG` header
- Build `lib/nowpayments.ts` as the single integration file — all API calls go through here
- With no API key in dev, checkout falls back to the local `/dev/nowpayments` simulator

**Environment variables in `.env.local`:**
```
NOWPAYMENTS_API_KEY=              # leave empty in dev to use the local simulator
NOWPAYMENTS_IPN_SECRET=          # for IPN webhook signature verification (HMAC-SHA512)
JWT_SECRET=                        # min 32 random chars
ADMIN_PASSWORD=                    # hashed with bcrypt on first run
AFFILIATE_DEFAULT_COMMISSION=10    # percent
AFFILIATE_MIN_PAYOUT_USDT=25       # minimum payout threshold (USDT, TRC20)
POSTAL_URL=                        # base URL of self-hosted Postal server
POSTAL_API_KEY=                    # Postal server API credential (invite + reset + order emails)
ENCRYPTION_KEY=                    # 32-byte hex key for encrypting bank details
```

---

## Admin Panel

- Protected by a single admin password (stored in `.env.local` as `ADMIN_PASSWORD`)
- No user accounts needed for the owner — single admin credential
- Features:
  - View all orders, filter by status
  - Mark orders as shipped
  - Print packing slip (print-friendly layout, no header/nav)
  - Add/edit/remove products (name, price, images, stock)
  - **Affiliate management:**
    - Generate invite links (UUID token, expires 48 hours)
    - View all affiliates — status, referral count, pending balance, total earned
    - Set per-affiliate commission rate (overrides default)
    - View individual referral history per affiliate
    - Approve or reject pending commissions
    - Mark payouts as processed (with optional admin note)
    - Suspend/reactivate affiliate accounts

---

## Packing Slip Layout
Each packing slip should include:
- Brand logo + name
- Order ID + date
- Customer name + shipping address
- Itemised product list (name, qty, unit price)
- Order total + currency
- "Thank you" message (customisable in `config/brand.ts`)
- Print triggered by browser `window.print()` — no PDF library needed

---

## Currencies

Use a simple lookup table — prices are stored per currency in the Product table. No live FX conversion needed. The customer selects currency on first visit (or auto-detected by IP if desired later).

---

## Folder Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage
│   ├── products/
│   ├── cart/
│   ├── checkout/
│   ├── order-confirmation/
│   └── admin/
├── components/             # Reusable UI components
├── config/
│   └── brand.ts            # ← ALL branding lives here
├── prisma/
│   └── schema.prisma       # SQLite schema
├── lib/
│   ├── db.ts               # Prisma client
│   ├── auth.ts             # JWT issue/verify helpers
│   ├── affiliate.ts        # Referral tracking, commission calculation
│   └── encrypt.ts          # AES-256-GCM for sensitive fields (bank details)
├── public/
│   └── logo.png            # ← swap this to rebrand
└── .env.local              # Secrets (never commit)
```

---

## Design Guidelines

- **Tone:** Clean, calm, trustworthy — not loud or salesy
- **Colours:** Default green palette (`#2D6A4F`) — easily swapped in `brand.ts`
- **Font:** Inter (Google Fonts)
- **Trust signals:** Include on homepage — secure checkout badge, simple returns policy line, contact info visible in footer
- **Mobile-first:** Most customers will be on phones

---

## Out of Scope (for now)
- User accounts / login
- Reviews / ratings
- Blog
- Discount codes (can add later)
- Live currency conversion

---

## Affiliate System

### How It Works
1. Admin generates an invite link from `/admin/affiliates/invite` — a UUID token with a 48-hour expiry
2. Admin sends the link manually (email/WhatsApp etc.)
3. Affiliate clicks link → lands on `/auth/register?token=XXXX` → creates account
4. On registration, their `AffiliateProfile` is auto-created with the default commission rate (configurable in `.env.local` as `AFFILIATE_DEFAULT_COMMISSION=10`)
5. Affiliate logs into `/dashboard` and copies their unique referral link: `https://yoursite.com/?ref=THEIRCODE`
6. When a customer visits via that link, the referral code is stored in a **cookie (30-day TTL)**
7. On completed, paid order: a `AffiliateReferral` record is created with status `pending`
8. Admin reviews and approves commissions in the admin panel
9. When affiliate requests a payout, admin sends USDT (TRC20) manually from the
   business wallet within 24–48 hours
10. Admin records the TRC20 tx hash and marks the payout as `paid` — balance
    updates accordingly

### Referral Tracking
- Referral code stored in a cookie: `ref_code`, `sameSite=lax`, `maxAge=2592000` (30 days)
- Last-click attribution — if customer clicks a new affiliate link, the cookie is overwritten
- Commission only created when order status changes to `paid` (via the NOWPayments webhook)
- Commission amount tracked in USDT, calculated from the order's USD subtotal at
  time of order (USDT is dollar-pegged; original order currency kept for audit)

### Affiliate Dashboard (`/dashboard`)
- Show unique referral link with one-click copy
- Lifetime stats: total referrals, total earned (USDT), pending balance, paid out
- Table of recent referrals: date, order value, commission, status
- Payout request button (only active when pending balance ≥ minimum threshold,
  default 25 USDT) with a notice that payouts are sent within 24–48 hours
- Wallet form — affiliate enters/updates their USDT (TRC20) address for payouts
- Read-only view — affiliates cannot see customer names or full order details

### Commission Rules
- Default rate: configurable via `AFFILIATE_DEFAULT_COMMISSION` env var (e.g. `10` = 10%)
- Per-affiliate override possible from admin panel
- Commission is calculated on the **order subtotal** (excluding shipping if applicable)
- Commissions are always stored and paid in **USDT** regardless of order currency
- Pending commissions are auto-rejected if the order is refunded/cancelled

### Security for Affiliate Accounts
- Invite tokens are single-use and expire after 48 hours
- Passwords: min 8 chars, must contain uppercase + number, hashed with bcrypt (cost 12)
- Affiliates can only see their own data — never other affiliates' info
- JWT session tokens, `httpOnly` cookie, 24-hour expiry with refresh
- Email verification required before dashboard access
- Affiliates cannot modify commission rates or payout status themselves
- Wallet addresses stored encrypted at rest (use `lib/encrypt.ts` with AES-256-GCM)

---

## Security — Non-Negotiable Rules

This section is mandatory. Every rule below must be implemented. No exceptions.

---

### 1. Environment & Secrets
- All secrets (NOWPayments keys, admin password, JWT secret) live **only** in `.env.local` — never in code, never in `config/brand.ts`, never committed to git
- `.env.local` must be in `.gitignore` from day one
- Add a `.env.example` file with blank placeholders so developers know what vars are needed without exposing real values
- Never log secrets, tokens, or full request bodies to console in production
- Use `NEXTAUTH_SECRET` (min 32 chars, randomly generated) for signing any session tokens

---

### 2. Admin Panel — Access Control
- Admin routes (`/admin/*`) must be protected with **server-side middleware** — not just client-side redirects, which can be bypassed
- Use `next/headers` + signed `httpOnly` cookie to track admin session
- Admin password must be hashed with **bcrypt** (min cost factor 12) before being stored/compared — never compare plain text
- Session tokens expire after **2 hours of inactivity**
- After **5 failed login attempts**, lock out that IP for 15 minutes (use an in-memory or SQLite-backed rate limiter)
- Admin login page must **not** reveal whether the password or username was wrong — always say "Invalid credentials"

```ts
// lib/adminAuth.ts — pattern to follow
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

// Always verify session server-side in every admin route handler
export async function requireAdmin() {
  const token = cookies().get('admin_session')?.value;
  if (!token) throw new Error('Unauthorised');
  await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
}
```

---

### 3. Input Validation & Sanitisation
- **Every** form input and API request body must be validated with **Zod** before touching the database
- Never trust client-supplied data — validate on the server, always
- Strip and reject unexpected fields (use `z.object({...}).strict()`)
- Validate and sanitise file uploads: allow only `image/jpeg`, `image/png`, `image/webp`; max 5MB; rename files to a random UUID on save — never use the original filename
- Reject any input containing `<script>`, SQL keywords in unexpected fields, or path traversal patterns (`../`)

```ts
// Example checkout validation
const CheckoutSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(254),
  phone: z.string().regex(/^\+?[0-9\s\-]{7,20}$/),
  address: z.string().min(5).max(500).trim(),
  currency: z.enum(['AED', 'PKR', 'USD', 'GBP']),
}).strict();
```

---

### 4. Database — Prisma Safety
- Always use **Prisma's query builder** — never raw SQL strings with user input
- If raw SQL is ever needed, use Prisma's `$queryRaw` with **tagged template literals only** (parameterised), never string concatenation
- The SQLite file must be stored **outside the `/public` folder** — it must never be web-accessible
- Store the DB at `/data/shifa.db` (not inside `/app` or `/public`)

```ts
// SAFE — parameterised
const order = await prisma.$queryRaw`SELECT * FROM Order WHERE id = ${orderId}`;

// NEVER DO THIS
const order = await prisma.$queryRawUnsafe(`SELECT * FROM Order WHERE id = '${orderId}'`);
```

---

### 5. API Routes — Server-Side Protection
- All `/api/*` routes that mutate data (create order, update status, add product) must verify the request origin using the `Origin` header or a **CSRF token**
- NOWPayments webhook endpoint (`/api/webhooks/nowpayments`) must verify the **IPN signature** on every incoming request — reject anything that fails verification. The signature is HMAC-SHA512 of the raw body in the `X-NOWPAYMENTS-SIG` header
- Never expose order details at a guessable URL — use **UUIDs** (not sequential integers) for order IDs
- Rate-limit all public API endpoints: checkout max 10 requests/min per IP, product listing max 60/min

```ts
// lib/nowpayments.ts — always verify the IPN webhook signature
export function verifyNowpaymentsSignature(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET!)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

---

### 6. HTTP Security Headers
Add the following headers to `next.config.js` — these protect against XSS, clickjacking, and MIME sniffing:

```js
// next.config.js
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // tighten after build
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // Crypto checkout is a top-level redirect to the NOWPayments hosted page,
      // so no extra connect/frame hosts are required.
      "connect-src 'self'",
      "form-action 'self'",
    ].join('; ')
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
];
```

---

### 7. Dependency & Supply Chain Safety
- Pin all dependencies to exact versions in `package.json` (no `^` or `~`)
- Run `npm audit` before every deploy — fix all critical and high severity issues before going live
- Do not install packages with fewer than 10,000 weekly downloads unless absolutely necessary
- Use only the official NOWPayments REST API as documented — no unofficial wrappers
- Do not use any community-built NOWPayments packages; write `lib/nowpayments.ts` from scratch against their documented API

---

### 8. File & Path Safety
- Never expose the filesystem structure in error messages
- All error responses to the client must be generic: `"Something went wrong"` — detailed errors go to server logs only
- Image upload paths must be validated to prevent path traversal:

```ts
import path from 'path';
const safeName = path.basename(filename); // strips any ../ attempts
```

---

### 9. HTTPS & Deployment
- HTTPS is enforced by Vercel automatically — never deploy to a non-HTTPS host
- Set `sameSite: 'strict'` and `secure: true` on all cookies
- Admin session cookie: `httpOnly: true, secure: true, sameSite: 'strict'`
- Enable Vercel's **DDoS protection** and **Web Application Firewall** (available on free tier)

---

### 10. Data Minimisation (GDPR / Privacy)
- Only collect what is needed to fulfil the order: name, email, phone, shipping address
- Do not store payment details — ever. Payment is crypto only; NOWPayments handles the entire payment on their own servers and the customer is redirected there to pay
- Add a clear privacy policy page listing what data is stored and why
- Provide a contact email for data deletion requests

---

### 11. Error Handling
- Wrap all API route handlers in try/catch — unhandled promise rejections can leak stack traces
- In production (`NODE_ENV=production`), never return stack traces or Prisma error messages to the client
- Use a consistent error response format:

```ts
// Always return this shape for errors
return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
// Log the real error server-side only
console.error('[internal]', err);
```

---

### 12. Pre-Launch Security Checklist

Before going live, verify every item:

- [ ] `.env.local` is in `.gitignore` and NOT in the repo
- [ ] Admin password is bcrypt-hashed, min 12 chars
- [ ] All `/admin/*` routes blocked server-side without valid session cookie
- [ ] NOWPayments IPN webhook verifies the HMAC-SHA512 signature before processing
- [ ] All form inputs validated with Zod on the server
- [ ] SQLite file is NOT in `/public`
- [ ] Security headers returning correctly (check via [securityheaders.com](https://securityheaders.com))
- [ ] `npm audit` returns zero critical/high issues
- [ ] No API keys or secrets visible in client-side JS bundle (check with browser DevTools)
- [ ] Order IDs are UUIDs, not sequential integers
- [ ] Rate limiting active on checkout and login endpoints
- [ ] Error messages shown to users are generic (no stack traces)
- [ ] HTTPS enforced, cookies are `secure` + `httpOnly` + `sameSite=strict`
- [ ] Affiliate invite tokens are single-use and expire after 48 hours
- [ ] Affiliates can only access their own dashboard data (server-side check on every request)
- [ ] Bank details are encrypted at rest with AES-256-GCM
- [ ] Commission records are created only via the NOWPayments webhook (not client-triggered)
- [ ] Email verification required before affiliate dashboard is accessible

---

## Getting Started Instructions (for Claude Code)

When starting this project, Claude should:
1. Scaffold a Next.js 14 app with Tailwind and Prisma
2. Set up SQLite database with the schema above — store DB file at `/data/shifa.db`, never in `/public`
3. Create `config/brand.ts` as the single source of truth for branding
4. Add security headers to `next.config.js` immediately — before any other work
5. Build storefront pages first (homepage → product page → cart → checkout)
6. Wire up NOWPayments using `lib/nowpayments.ts` — implement Create Invoice, the IPN webhook handler, and HMAC-SHA512 signature verification. Reference the NOWPayments API docs for exact endpoints
7. Build auth system (register/login/forgot-password) using Jose + bcrypt
8. Build affiliate invite flow — admin generates token, affiliate registers via token
9. Build affiliate dashboard — referral link, earnings table, payout request
10. Build admin affiliate panel — view affiliates, approve commissions, mark payouts
11. Build the admin panel last — with bcrypt auth, server-side middleware, and rate limiting
8. Never hardcode brand name, colours, or logo paths — always reference `config/brand.ts`
12. Never hardcode secrets — always use `process.env.*`
13. Run `npm audit` and fix all issues before declaring the build complete
