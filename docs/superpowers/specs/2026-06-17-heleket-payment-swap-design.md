# Heleket payment provider swap — design

**Date:** 2026-06-17
**Status:** Approved (design)
**Supersedes:** the NOWPayments crypto integration introduced when Paykassma was removed (commit `cd4dcee`).

## Summary

Replace the current crypto payment provider (**NOWPayments**) with **Heleket** (formerly Cryptomus). This is a clean swap: NOWPayments code is removed entirely, mirroring the earlier Paykassma removal. The customer-facing flow is unchanged — coin selection in our UI, redirect to a hosted payment page, webhook-driven confirmation. Heleket supports all four coins we offer (BTC, ETH, USDT, XMR), so the checkout UI and payment-method enum are unchanged.

The affiliate/commission/payout system, order data model, stock-decrement logic, confirmation emails, and the `pending → paid` idempotency guard are **provider-agnostic and unchanged**.

## Goals

- Swap the crypto gateway from NOWPayments to Heleket with no change to customer-facing behavior.
- Keep the integration isolated to one client module + one webhook route, as today.
- Work end-to-end locally via a dev simulator (no Heleket keys required yet).
- Verify the riskiest logic (webhook signature) via a smoke script, per project convention (no test runner).

## Non-goals

- No change to the affiliate, commission, or USDT payout systems.
- No change to the checkout UI, coins offered, pricing, or the 10% crypto discount.
- No change to the order/payment data model or Prisma schema.
- Heleket payout/withdrawal API (affiliate payouts remain a manual admin process).

## Heleket API reference (as designed against)

- **Create payment:** `POST https://api.heleket.com/v1/payment`
  - Headers: `merchant: <HELEKET_MERCHANT_ID>`, `sign: <signature>`, `Content-Type: application/json`.
  - Request `sign` = `md5( base64(requestBodyString) + HELEKET_PAYMENT_API_KEY )`. The signed string MUST be the exact body sent.
  - Body fields used: `amount` (string, e.g. `"90.00"`), `currency` (`"USD"`), `order_id`, `url_callback`, `url_success`, `url_return`.
  - Response shape: `{ state: 0, result: { uuid, order_id, url, payment_status, ... } }`. Hosted page = `result.url`; payment reference = `result.uuid`.
- **Webhook:** Heleket POSTs JSON to `url_callback` on every status change.
  - Signature is delivered **in the body** as a `sign` field (no signature header).
  - Verify: take parsed body, remove `sign`, JSON-encode it, base64-encode, `md5( base64 + HELEKET_PAYMENT_API_KEY )`, compare (timing-safe) to the received `sign`.
  - PHP gotcha: PHP's `json_encode` escapes forward slashes (`/` → `\/`); Node's `JSON.stringify` does not. We escape slashes to match.
  - `status` values: `confirm_check`, `paid`, `paid_over`, `fail`, `wrong_amount`, `cancel`, `system_fail`, `refund_process`, `refund_fail`, `refund_paid`. **Successful = `paid` or `paid_over`.**
  - Other useful fields: `uuid`, `order_id`, `amount`, `payment_amount`, `txid`, `is_final`, `currency`, `payer_currency`.

## Architecture / file-by-file changes

### `lib/heleket.ts` (replaces `lib/nowpayments.ts`)

Keeps the same exported surface so callers change minimally:

- `type CryptoPaymentMethod = "btc" | "eth" | "usdt" | "xmr"` — unchanged.
- `createCryptoPayment(input): Promise<CreateCryptoPaymentResult>` — builds the Heleket payload, computes the request `sign`, POSTs to `/v1/payment`, returns `{ paymentUrl: result.url, paymentRef: result.uuid, invoiceId: result.uuid }`.
- `verifyHeleketSignature(parsedBody, sign): boolean` — the verification described above; timing-safe compare on the md5 hex.
- `signHeleketWebhook(data): string` — produces a `sign` for a body the **same way** the verifier checks it (shared serializer), so the dev simulator round-trips. Also used to confirm internal consistency in the smoke script.
- Internal helpers: `signRequestBody(bodyString)` for the outbound request header; a single `canonicalJson(obj)` used by both signer and verifier (does the slash-escaping) so they cannot diverge.
- **Mock mode:** active when `HELEKET_MERCHANT_ID` is unset. Returns `paymentUrl = ${siteUrl}/dev/heleket?invoice=hl_<orderId-prefix>`, `paymentRef = invoiceId = hl_<...>`. (Same pattern as the current `np_` mock.)

### `app/api/checkout/route.ts`

- Change the import from `@/lib/nowpayments` to `@/lib/heleket`. Function name and call site unchanged.
- `amount` stays `subtotalUsd.toFixed(2)`, currency `USD`. The 10% crypto discount logic, order creation, `paymentRef` update, and `notes` string are unchanged.

### `app/api/webhooks/heleket/route.ts` (replaces `app/api/webhooks/nowpayments/route.ts`)

- Read the raw body (`req.text()`), `JSON.parse`, extract `sign` from the parsed object.
- Reject with `401` if `sign` is missing or `verifyHeleketSignature` fails.
- Acknowledge (`200 {ok:true}`) for any non-success status so Heleket stops retrying.
- On success (`status === "paid" || status === "paid_over"`): look up the order by `order_id`; if unknown, `200 {ok:true}`. Only the `pending → paid` transition does work (idempotent). The transaction body — set `status:"paid"`, set `paymentRef` to `uuid`, decrement stock — then `createReferralForPaidOrder(orderId)` and `sendOrderConfirmationEmail` — is **ported unchanged** from the current webhook.

### `app/(store)/dev/heleket/page.tsx` (replaces `app/(store)/dev/nowpayments/page.tsx`)

- Enabled only when `HELEKET_MERCHANT_ID` is unset. Invoice prefix `hl_`.
- "Simulate successful payment" / "Simulate failed payment" build a Heleket-shaped webhook body (`{ type:"payment", uuid, order_id, amount, currency, status: "paid" | "cancel", is_final: true, ... }`), sign it via `signHeleketWebhook`, POST to `/api/webhooks/heleket`, then redirect to the confirmation or `/checkout?cancelled=1`, exactly like the current simulator.

### `.env.example`

- Remove `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`.
- Add `HELEKET_MERCHANT_ID` and `HELEKET_PAYMENT_API_KEY` with a comment: obtain from Heleket merchant dashboard; leave empty for dev mode (uses local simulator).

### `next.config.js`

- Update the CSP comment to name Heleket. No host changes needed — the redirect is a top-level navigation, not a fetch/frame, so `connect-src`/`form-action` stay `'self'`.

### Copy & docs

- Swap "NOWPayments" → "Heleket" in user-facing copy: `app/(store)/privacy/page.tsx`, `app/(store)/page.tsx`, `app/(store)/products/[slug]/page.tsx`, and `config/brand.ts` (verify each actual usage during implementation).
- Update the comment reference in `lib/affiliate.ts`.
- Update provider-setup docs: `README.md`, `CRYPTO_IMPLEMENTATION.md`, `CRYPTO_SETUP.md`, `CRYPTO_QUICKSTART.md`.
- Leave historical specs/plans under `docs/superpowers/` unchanged — they are records of past decisions.

### `scripts/smoke-heleket.ts` (new)

- Round-trip test: `signHeleketWebhook(sample)` then `verifyHeleketSignature(sample, sign)` returns true; a tampered body returns false.
- Drives the `paid` webhook path against a seeded pending order in dev/mock mode and asserts the order becomes `paid`, stock decrements, and (if a `refCode` is present) a commission row is created.
- Matches the existing `smoke-*.ts` style and the project's smoke-script verification workflow.

## Data flow (unchanged from today, new provider)

1. Checkout POST → server prices items, applies 10% discount, creates `pending` order.
2. `createCryptoPayment` → Heleket `/v1/payment` → store `paymentRef = uuid`, return `result.url`.
3. Browser redirected (top-level) to Heleket hosted page; customer pays in their chosen coin.
4. Heleket POSTs webhook → verify `sign` → on `paid`/`paid_over`, the `pending → paid` transition marks paid, decrements stock, creates commissions, sends confirmation email.
5. Customer returns to `/order-confirmation/{id}` (or `/checkout?cancelled=1`).

## Decisions

- **Coin restriction (Decision 1): parity / generic invoice.** Do not pass `currencies` to lock the hosted page to the selected coin; the Heleket page lets the customer pay in any supported coin, and `paymentMethod` remains a stored preference — identical to current NOWPayments behavior. Restricting per-coin (with USDT network handling) is a possible future enhancement.
- **Signature handling (Decision 2): shared signer + slash-escaping.** One canonical serializer backs both `verifyHeleketSignature` and `signHeleketWebhook`, so the dev-simulator loop round-trips. Slash-escaping is applied for PHP/Heleket compatibility.

## Risks & mitigations

- **Byte-exact signature compatibility with live Heleket is unproven without keys.** Mitigation: canonical serializer matches Heleket's documented PHP scheme (slash-escaping, drop `sign`); confirm with a smoke test against a real webhook (or Heleket's "test webhook" method) once `HELEKET_MERCHANT_ID`/`HELEKET_PAYMENT_API_KEY` are added. If live signatures fail, the fallback is to verify against the raw request body string rather than a re-serialization.
- **JSON key order / unicode in re-serialization.** `JSON.parse` then `JSON.stringify` preserves received key order; our signed fields are ASCII-only (no unicode in `additional_data`), so re-encoding reproduces the signed bytes.

## Verification

- `npm run build` (`prisma generate && next build`) and `tsc` pass.
- `scripts/smoke-heleket.ts` passes (signature round-trip + paid-webhook path).
- Manual dev run: checkout → `/dev/heleket` → "Simulate success" marks the order paid and shows the confirmation page; "Simulate failed" returns to checkout cancelled.
- `grep -ri nowpayments` over source (excluding `node_modules`, `.next`, and historical `docs/superpowers/`) returns nothing.
