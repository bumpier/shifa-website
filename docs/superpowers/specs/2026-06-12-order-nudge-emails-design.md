# Order lifecycle emails + repurchase nudges — design

**Date:** 2026-06-12
**Status:** Approved

## Goal

Track what customers ordered and when, email them at order lifecycle
milestones, and automatically nudge them to repurchase consumable products
when their supply is about to run out.

## Decisions (confirmed with owner)

- Nudge timing is driven by a **per-product `supplyDays`** field.
- Emails in scope: **repurchase nudge, order confirmation (on paid),
  shipped notification, delivered notification**. No second follow-up nudge.
- **No discount code** in the nudge (no coupon system exists; out of scope).
- Daily job runs via **server cron hitting a secured API route**
  (`CRON_SECRET` bearer token) — the site is self-hosted with SQLite.

## Schema changes (`prisma/schema.prisma`)

1. `Product.supplyDays Int @default(0)` — days one unit lasts.
   `0` means "never nudge for this product" (default, safe for non-consumables).
2. New model `EmailLog`:
   ```prisma
   model EmailLog {
     id        String   @id @default(uuid())
     orderId   String
     order     Order    @relation(fields: [orderId], references: [id])
     type      String   // confirmation | shipped | delivered | nudge
     recipient String
     sentAt    DateTime @default(now())

     @@unique([orderId, type])
   }
   ```
   Serves as both the audit trail and the idempotency guard — the unique
   constraint makes double-sends impossible even under concurrent webhooks.
3. New model `EmailOptOut`:
   ```prisma
   model EmailOptOut {
     email     String   @id
     createdAt DateTime @default(now())
   }
   ```

Migration via `prisma migrate dev` (SQLite).

## Components

### `lib/customer-email.ts` (new)

Customer-facing email senders, built on the existing `send`/`layout`
pattern in `lib/email.ts` (the existing file stays affiliate/auth-only):

- `sendOrderConfirmationEmail(order)` — receipt: items, totals, currency.
- `sendOrderShippedEmail(order)` / `sendOrderDeliveredEmail(order)`.
- `sendRepurchaseNudgeEmail(order, products)` — "running low?" with the
  previously bought items linking back to `/products/<slug>`; footer
  carries the unsubscribe link.
- Each sender logs to `EmailLog` first (create inside try; unique-violation
  means already sent → skip), then sends. Send failures are caught and
  logged to console — a Resend outage must never break a webhook or admin
  action.

### Transactional triggers (existing files)

- **Confirmation:** in `app/api/webhooks/paykassma/route.ts` and
  `app/api/webhooks/nowpayments/route.ts`, after the order is flipped to
  `paid`, fire-and-forget `sendOrderConfirmationEmail`.
- **Shipped / Delivered:** in `updateOrderStatus` in
  `app/admin/actions.ts`, after the status update, send the matching email
  when the new status is `shipped` or `delivered`.

### Nudge job — `app/api/cron/nudges/route.ts` (new)

- `POST` (and `GET` for easy curl) guarded by
  `Authorization: Bearer ${CRON_SECRET}`; 401 otherwise; 503 if the env var
  is unset.
- Logic:
  1. Load orders with status `paid | shipped | delivered` that have no
     `nudge` row in `EmailLog`.
  2. For each, parse `items` JSON; for items whose product has
     `supplyDays > 0`, compute `dueAt = order.createdAt +
     min(qty × supplyDays) − LEAD_DAYS (4)`.
  3. Skip when: no nudgeable items, `dueAt` in the future, the customer
     email has a **newer** order (they already repurchased), or the email
     is in `EmailOptOut`.
  4. Otherwise send the nudge (EmailLog dedupes).
- Returns `{ scanned, sent, skipped }` JSON for observability.
- Server crontab (documented in README):
  `15 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/nudges`

### Unsubscribe — `app/api/email/unsubscribe/route.ts` (new)

- `GET /api/email/unsubscribe?email=<e>&sig=<hmac>` where
  `sig = HMAC-SHA256(email, CRON_SECRET-independent UNSUBSCRIBE_SECRET or
  JWT_SECRET)`. Constant-time comparison; on success upsert `EmailOptOut`
  and return a tiny "You're unsubscribed" HTML page.
- Helper `unsubscribeUrl(email)` in `lib/customer-email.ts`.
- Only the **nudge** (marketing) checks/links opt-out; transactional
  emails (confirmation/shipped/delivered) always send.

### Admin UI

- **Product form** (`app/admin/products/ProductForm.tsx` + actions/
  validation): numeric "Supply days per unit" field, default 0, helper text
  "0 = no repurchase reminder".
- **Order detail** (`app/admin/orders/[id]/page.tsx`): "Emails sent"
  section listing `EmailLog` rows (type + timestamp).

## Env vars

- `CRON_SECRET` — bearer token for the cron route (add to `.env.example`).
- Unsubscribe HMAC reuses `JWT_SECRET` (already mandatory) to avoid another
  secret.

## Error handling

- Email sending never throws into callers (fire-and-forget with logging).
- Cron route processes orders independently; one failure doesn't abort the
  run (per-order try/catch, counted in `skipped`).
- `EmailLog` unique constraint is the source of truth against duplicates.

## Testing

- No test runner exists in this project; verification is manual:
  dev-mode emails print to console (existing `lib/email.ts` behaviour),
  so: seed an old order, hit the cron route with curl, confirm console
  output and `EmailLog` rows; flip statuses in admin and confirm emails;
  hit unsubscribe link and confirm nudge skip.

## Out of scope

- Discount/coupon system, follow-up nudge sequences, customer accounts,
  per-variant supply days (variants share the product's `supplyDays`).
