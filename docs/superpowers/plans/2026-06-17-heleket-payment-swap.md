# Heleket Payment Provider Swap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the NOWPayments crypto gateway with Heleket, with no change to customer-facing behavior.

**Architecture:** Heleket's hosted-invoice flow maps onto the current redirect flow. Swap the isolated provider client (`lib/heleket.ts`) and webhook route (`app/api/webhooks/heleket/route.ts`), keeping the provider-agnostic order/affiliate/email logic untouched. The webhook's downstream work (mark paid → decrement stock → create commissions → send email) is ported verbatim. A dev simulator and a smoke script make the riskiest piece — the Heleket signature scheme — verifiable locally without real keys.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma + SQLite, `tsx` for smoke scripts. No test runner.

## Global Constraints

- Coins offered are unchanged: `btc`, `eth`, `usdt`, `xmr`. `CheckoutSchema.paymentMethod` enum stays `z.enum(["btc","eth","usdt","xmr"])`.
- The 10% crypto discount, order creation, pricing, and `Prisma` schema are unchanged.
- Payment amount sent to the gateway is `subtotalUsd.toFixed(2)` with currency `"USD"`.
- Mock/dev mode is active when `HELEKET_MERCHANT_ID` is unset (mirrors the old `NOWPAYMENTS_API_KEY` gate).
- One key, `HELEKET_PAYMENT_API_KEY`, signs outbound requests AND verifies inbound webhooks.
- Successful webhook statuses are exactly `"paid"` and `"paid_over"`. All other statuses are acknowledged with HTTP 200 and do nothing.
- `paymentRef` is set to the Heleket payment `uuid`.
- Heleket signature scheme: `sign = md5( base64( canonicalJson(data) ) + HELEKET_PAYMENT_API_KEY )`, where `canonicalJson` is `JSON.stringify(data)` with forward slashes escaped (`/` → `\/`) to match PHP's `json_encode`. The webhook `sign` is in the request body (no header) and is excluded from the signed `data`.
- Affiliate, commission, USDT payout, order, and email code is provider-agnostic — do NOT modify it.
- Historical docs under `docs/superpowers/specs/` and `docs/superpowers/plans/` are records — do NOT rewrite them.
- Work on the `heleket-payments` branch. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Verification tooling (no test runner): `npx tsc --noEmit` (typecheck), `npm run build` (prisma generate + next build), `DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts` (smoke), and a manual dev run.

**Spec:** `docs/superpowers/specs/2026-06-17-heleket-payment-swap-design.md`

---

## File Structure

- **Create** `lib/heleket.ts` — Heleket client + signature helpers. Same exported surface as `lib/nowpayments.ts` (`CryptoPaymentMethod`, `CreateCryptoPaymentInput`, `CreateCryptoPaymentResult`, `createCryptoPayment`), plus `verifyHeleketSignature` and `signHeleketWebhook`.
- **Create** `app/api/webhooks/heleket/route.ts` — webhook handler; verifies body `sign`, maps `paid`/`paid_over` to the paid transition.
- **Create** `app/(store)/dev/heleket/page.tsx` — local payment simulator (active only in mock mode).
- **Create** `scripts/smoke-heleket.ts` — signature round-trip + paid-webhook transition checks.
- **Modify** `app/api/checkout/route.ts` — change one import.
- **Delete** `lib/nowpayments.ts`, `app/api/webhooks/nowpayments/route.ts`, `app/(store)/dev/nowpayments/page.tsx`.
- **Modify** `.env.example`, `next.config.js` (comment), and provider-name copy in `config/brand.ts`, `app/(store)/privacy/page.tsx`, `app/(store)/page.tsx`, `app/(store)/products/[slug]/page.tsx`, `components/PaymentMethods.tsx`, the comment in `lib/affiliate.ts`, plus `README.md`, `CRYPTO_IMPLEMENTATION.md`, `CRYPTO_SETUP.md`, `CRYPTO_QUICKSTART.md`.

---

## Task 1: Heleket client + signature helpers

**Files:**
- Create: `lib/heleket.ts`
- Test: `scripts/smoke-heleket.ts` (signature section only in this task)

**Interfaces:**
- Consumes: `process.env.HELEKET_MERCHANT_ID`, `process.env.HELEKET_PAYMENT_API_KEY`, `process.env.NEXT_PUBLIC_SITE_URL`.
- Produces:
  - `type CryptoPaymentMethod = "btc" | "eth" | "usdt" | "xmr"`
  - `interface CreateCryptoPaymentInput { orderId: string; amount: string; method: CryptoPaymentMethod; customerName: string; customerEmail: string; }`
  - `interface CreateCryptoPaymentResult { paymentUrl: string; paymentRef: string; invoiceId: string; }`
  - `function createCryptoPayment(input: CreateCryptoPaymentInput): Promise<CreateCryptoPaymentResult>`
  - `function verifyHeleketSignature(parsed: Record<string, unknown>, sign: string | undefined): boolean`
  - `function signHeleketWebhook(data: Record<string, unknown>): string`

- [ ] **Step 1: Write the failing test (signature round-trip)**

Create `scripts/smoke-heleket.ts` with just the signature checks for now:

```ts
// Throwaway smoke test for the Heleket payment integration. Run with:
//   DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts
//
// Covers the two genuinely new pieces: the webhook signature scheme
// (sign/verify round-trip) and the paid-webhook → order transition.

// Set a payment key before exercising the signer/verifier.
process.env.HELEKET_PAYMENT_API_KEY = "smoke-test-key";

import { signHeleketWebhook, verifyHeleketSignature } from "../lib/heleket";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function main() {
  // 1) Signature round-trip
  const sample = { type: "payment", uuid: "abc", order_id: "xyz", status: "paid" };
  const sign = signHeleketWebhook(sample);
  assert(verifyHeleketSignature({ ...sample, sign }, sign), "valid signature verifies");
  assert(!verifyHeleketSignature({ ...sample, status: "fail", sign }, sign), "tampered body fails");
  assert(!verifyHeleketSignature({ ...sample, sign }, "deadbeef"), "wrong sign fails");

  console.log("\nSignature checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/smoke-heleket.ts`
Expected: FAIL — `Cannot find module '../lib/heleket'` (the client does not exist yet).

- [ ] **Step 3: Implement `lib/heleket.ts`**

```ts
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────
// Heleket integration for crypto payments (BTC, ETH, USDT, XMR)
//
// API docs: https://doc.heleket.com/
// Create payment: POST https://api.heleket.com/v1/payment
// Webhook: POST to /api/webhooks/heleket (sign is in the body, no header)
//
// Environment variables required:
// - HELEKET_MERCHANT_ID      (merchant UUID; unset => local mock mode)
// - HELEKET_PAYMENT_API_KEY  (payment API key; signs requests + verifies webhooks)
// ─────────────────────────────────────────────────────────────────

export type CryptoPaymentMethod = "btc" | "eth" | "usdt" | "xmr";

export interface CreateCryptoPaymentInput {
  orderId: string;
  amount: string; // decimal string in USD, e.g. "90.00"
  method: CryptoPaymentMethod;
  customerName: string;
  customerEmail: string;
}

export interface CreateCryptoPaymentResult {
  paymentUrl: string;
  paymentRef: string;
  invoiceId: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function isMockMode(): boolean {
  return !process.env.HELEKET_MERCHANT_ID;
}

/**
 * Serialize exactly the way Heleket's PHP backend does: json_encode escapes
 * forward slashes ("/" -> "\/"); JS JSON.stringify does not. Both the request
 * signer and the webhook verifier MUST use this so signatures match.
 */
function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/\//g, "\\/");
}

/** Heleket sign = md5( base64(canonicalJson(data)) + paymentApiKey ). */
function makeSign(obj: unknown, key: string): string {
  const base64 = Buffer.from(canonicalJson(obj), "utf8").toString("base64");
  return crypto.createHash("md5").update(base64 + key).digest("hex");
}

export async function createCryptoPayment(
  input: CreateCryptoPaymentInput
): Promise<CreateCryptoPaymentResult> {
  // In development without a merchant ID, return a local mock payment URL.
  if (isMockMode()) {
    const mockInvoiceId = `hl_${input.orderId.slice(0, 12)}`;
    return {
      paymentUrl: `${siteUrl()}/dev/heleket?invoice=${mockInvoiceId}`,
      paymentRef: mockInvoiceId,
      invoiceId: mockInvoiceId,
    };
  }

  const merchantId = process.env.HELEKET_MERCHANT_ID;
  const apiKey = process.env.HELEKET_PAYMENT_API_KEY;
  if (!merchantId || !apiKey) {
    throw new Error("Heleket credentials are not configured");
  }

  const payload = {
    amount: input.amount,
    currency: "USD",
    order_id: input.orderId,
    url_callback: `${siteUrl()}/api/webhooks/heleket`,
    url_return: `${siteUrl()}/checkout?cancelled=1`,
    url_success: `${siteUrl()}/order-confirmation/${input.orderId}`,
  };

  // The signed string MUST be the exact body we send.
  const body = canonicalJson(payload);
  const sign = makeSign(payload, apiKey);

  const response = await fetch("https://api.heleket.com/v1/payment", {
    method: "POST",
    headers: {
      merchant: merchantId,
      sign,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[heleket] create payment failed", response.status, error);
    throw new Error("Crypto payment gateway error");
  }

  const data = (await response.json()) as {
    result?: { uuid?: string; url?: string };
  };

  if (!data.result?.url || !data.result?.uuid) {
    console.error("[heleket] unexpected response", data);
    throw new Error("Crypto payment gateway returned unexpected response");
  }

  return {
    paymentUrl: data.result.url,
    paymentRef: data.result.uuid,
    invoiceId: data.result.uuid,
  };
}

/**
 * Verify a Heleket webhook. Heleket embeds `sign` in the JSON body (no header):
 * sign = md5( base64(json_encode(body_without_sign)) + paymentApiKey ).
 */
export function verifyHeleketSignature(
  parsed: Record<string, unknown>,
  sign: string | undefined
): boolean {
  const key = process.env.HELEKET_PAYMENT_API_KEY;
  if (!key || !sign) return false;

  const { sign: _omit, ...data } = parsed;
  const expected = makeSign(data, key);

  const a = Buffer.from(expected);
  const b = Buffer.from(sign);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Sign a webhook body the same way Heleket would — used by the dev simulator
 * and the smoke test. Reads HELEKET_PAYMENT_API_KEY.
 */
export function signHeleketWebhook(data: Record<string, unknown>): string {
  const key = process.env.HELEKET_PAYMENT_API_KEY;
  if (!key) throw new Error("HELEKET_PAYMENT_API_KEY not set");
  return makeSign(data, key);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/smoke-heleket.ts`
Expected: PASS — three `ok:` lines then `Signature checks passed.`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/heleket.ts scripts/smoke-heleket.ts
git commit -m "feat: Heleket client and webhook signature helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Heleket webhook route + paid-transition smoke check

**Files:**
- Create: `app/api/webhooks/heleket/route.ts`
- Test: extend `scripts/smoke-heleket.ts`

**Interfaces:**
- Consumes: `verifyHeleketSignature` (Task 1), `prisma` from `@/lib/db`, `createReferralForPaidOrder` from `@/lib/affiliate`, `sendOrderConfirmationEmail` from `@/lib/customer-email`.
- Produces: `export async function POST(req: Request): Promise<Response>` at route `/api/webhooks/heleket`.

- [ ] **Step 1: Write the failing test (extend the smoke script)**

Replace the contents of `scripts/smoke-heleket.ts` with the full version (adds DB + webhook-route checks):

```ts
// Throwaway smoke test for the Heleket payment integration. Run with:
//   DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts
//
// Covers the two genuinely new pieces: the webhook signature scheme
// (sign/verify round-trip) and the paid-webhook → order transition.

// Set a payment key before exercising the signer/verifier.
process.env.HELEKET_PAYMENT_API_KEY = "smoke-test-key";

import { prisma } from "../lib/db";
import { signHeleketWebhook, verifyHeleketSignature } from "../lib/heleket";
import { POST as heleketWebhook } from "../app/api/webhooks/heleket/route";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

function signedRequest(data: Record<string, unknown>): Request {
  const body = JSON.stringify({ ...data, sign: signHeleketWebhook(data) });
  return new Request("http://localhost:3000/api/webhooks/heleket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function cleanup() {
  const orders = await prisma.order.findMany({
    where: { customerEmail: { contains: "smoke-heleket" } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  await prisma.affiliateReferral.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.emailLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { contains: "smoke-heleket" } } });
}

async function main() {
  await cleanup();

  // 1) Signature round-trip
  const sample = { type: "payment", uuid: "abc", order_id: "xyz", status: "paid" };
  const sign = signHeleketWebhook(sample);
  assert(verifyHeleketSignature({ ...sample, sign }, sign), "valid signature verifies");
  assert(!verifyHeleketSignature({ ...sample, status: "fail", sign }, sign), "tampered body fails");
  assert(!verifyHeleketSignature({ ...sample, sign }, "deadbeef"), "wrong sign fails");

  // 2) Affiliate + pending order with a referral code (items [] => no stock needed)
  const affiliate = await prisma.user.create({
    data: {
      email: "aff.smoke-heleket@test.local",
      name: "Smoke Affiliate",
      passwordHash: "x",
      affiliateProfile: { create: { referralCode: "smokehel", commissionRate: 10 } },
    },
    include: { affiliateProfile: true },
  });
  assert(!!affiliate.affiliateProfile, "affiliate profile created");

  const order = await prisma.order.create({
    data: {
      customerName: "Smoke Customer",
      customerEmail: "customer.smoke-heleket@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]",
      currency: "USD",
      totalAmount: 90,
      subtotalUsd: 90,
      paymentMethod: "usdt",
      refCode: "smokehel",
      status: "pending",
    },
  });

  // 3) paid webhook flips pending → paid and creates a commission
  const res = await heleketWebhook(
    signedRequest({ type: "payment", uuid: "hl_live_1", order_id: order.id, status: "paid", is_final: true })
  );
  assert(res.status === 200, "paid webhook returns 200");
  const paid = await prisma.order.findUnique({ where: { id: order.id } });
  assert(paid!.status === "paid", "order marked paid");
  assert(paid!.paymentRef === "hl_live_1", "paymentRef set to Heleket uuid");
  const refs = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs.length === 1 && refs[0]!.kind === "direct", "commission created");

  // 4) retry is a no-op (idempotent)
  await heleketWebhook(
    signedRequest({ type: "payment", uuid: "hl_live_1", order_id: order.id, status: "paid", is_final: true })
  );
  const refs2 = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs2.length === 1, "retry does not duplicate commission");

  // 5) bad signature is rejected and does not change state
  const order2 = await prisma.order.create({
    data: {
      customerName: "Smoke Customer 2",
      customerEmail: "customer2.smoke-heleket@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]",
      currency: "USD",
      totalAmount: 50,
      subtotalUsd: 50,
      paymentMethod: "btc",
      status: "pending",
    },
  });
  const badReq = new Request("http://localhost:3000/api/webhooks/heleket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "payment", order_id: order2.id, status: "paid", sign: "deadbeef" }),
  });
  const badRes = await heleketWebhook(badReq);
  assert(badRes.status === 401, "bad signature rejected with 401");
  const stillPending = await prisma.order.findUnique({ where: { id: order2.id } });
  assert(stillPending!.status === "pending", "order unchanged after bad signature");

  await cleanup();
  console.log("\nAll smoke checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts`
Expected: FAIL — `Cannot find module '../app/api/webhooks/heleket/route'`.

- [ ] **Step 3: Implement the webhook route**

Create `app/api/webhooks/heleket/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyHeleketSignature } from "@/lib/heleket";
import { createReferralForPaidOrder } from "@/lib/affiliate";
import { sendOrderConfirmationEmail } from "@/lib/customer-email";

export const dynamic = "force-dynamic";

// Heleket statuses that mean the invoice is paid. Everything else (confirm_check,
// cancel, fail, wrong_amount, system_fail, refund_*) is acknowledged as a no-op.
const PAID_STATUSES = new Set(["paid", "paid_over"]);

export async function POST(req: Request) {
  const raw = await req.text();

  let data: {
    type?: string;
    uuid?: string;
    order_id?: string;
    status?: string;
    sign?: string;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!verifyHeleketSignature(data as Record<string, unknown>, data.sign)) {
    console.error("[heleket] webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    // Acknowledge non-success statuses so Heleket stops retrying.
    if (!data.status || !PAID_STATUSES.has(data.status)) {
      return NextResponse.json({ ok: true });
    }

    const orderId = data.order_id;
    if (!orderId) {
      console.error("[heleket] webhook missing order_id");
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      // Acknowledge so the gateway stops retrying an unknown reference
      return NextResponse.json({ ok: true });
    }

    // Only the pending → paid transition does work; webhook retries are no-ops
    if (order.status === "pending") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "paid",
            paymentRef: data.uuid ?? order.paymentRef,
          },
        });
        // Decrement stock now that payment is confirmed
        const items = JSON.parse(order.items) as { productId: string; qty: number }[];
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } },
          });
        }
      });
      // Commission records are created ONLY here — webhook-driven
      await createReferralForPaidOrder(orderId);
      const paidOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (paidOrder) void sendOrderConfirmationEmail(paidOrder);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[heleket] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts`
Expected: PASS — all `ok:` lines then `All smoke checks passed.` (A `[email] send failed …` log line may appear because Postal is not configured in the smoke env; the senders never throw, so this is expected and harmless.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/heleket/route.ts scripts/smoke-heleket.ts
git commit -m "feat: Heleket webhook route marks orders paid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Heleket dev payment simulator

**Files:**
- Create: `app/(store)/dev/heleket/page.tsx`

**Interfaces:**
- Consumes: `signHeleketWebhook` (Task 1), the `/api/webhooks/heleket` route (Task 2), `prisma`, `formatPrice`/`Currency` from `@/config/brand`.
- Produces: a page at `/dev/heleket?invoice=hl_<id>` (active only when `HELEKET_MERCHANT_ID` is unset) with "Simulate successful payment" / "Simulate failed payment" actions.

- [ ] **Step 1: Implement the simulator page**

Create `app/(store)/dev/heleket/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice, type Currency } from "@/config/brand";
import { signHeleketWebhook } from "@/lib/heleket";

export const dynamic = "force-dynamic";

function simulatorEnabled(): boolean {
  return !process.env.HELEKET_MERCHANT_ID;
}

async function deliverWebhook(invoiceId: string, confirmed: boolean) {
  "use server";
  if (!simulatorEnabled()) return;

  const orderId = invoiceId.replace("hl_", "");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  const data: Record<string, unknown> = {
    type: "payment",
    uuid: invoiceId,
    order_id: order.id,
    amount: order.totalAmount.toString(),
    currency: order.currency,
    status: confirmed ? "paid" : "cancel",
    is_final: true,
  };
  const body = JSON.stringify({ ...data, sign: signHeleketWebhook(data) });

  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/heleket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  redirect(confirmed ? `/order-confirmation/${order.id}` : "/checkout?cancelled=1");
}

export default async function HeleketSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  if (!simulatorEnabled()) notFound();
  const { invoice: invoiceId } = await searchParams;
  if (!invoiceId?.startsWith("hl_")) notFound();

  const orderId = invoiceId.replace("hl_", "");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  const payAction = deliverWebhook.bind(null, invoiceId, true);
  const failAction = deliverWebhook.bind(null, invoiceId, false);

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Sandbox · not a real payment page</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-brand-deep">
          Crypto payment simulator
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Simulates the Heleket payment page. Choosing an outcome sends a
          correctly signed webhook to the real webhook endpoint.
        </p>

        <dl className="mt-6 space-y-2 rounded-xl bg-brand-tint p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Order</dt>
            <dd className="font-mono text-xs">{order.id.slice(0, 13)}…</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Method</dt>
            <dd className="font-semibold capitalize">{order.paymentMethod}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Amount</dt>
            <dd className="font-semibold">
              {formatPrice(order.totalAmount.toString(), order.currency as Currency)}
            </dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-3">
          <form action={payAction}>
            <button type="submit" className="btn-primary w-full">
              Simulate successful payment
            </button>
          </form>
          <form action={failAction}>
            <button
              type="submit"
              className="w-full rounded-full border border-red-200 px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Simulate failed payment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(store)/dev/heleket/page.tsx"
git commit -m "feat: Heleket dev payment simulator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Switch checkout to Heleket and remove NOWPayments

**Files:**
- Modify: `app/api/checkout/route.ts:7`
- Modify: `.env.example:9-13`
- Modify: `next.config.js:19-20` (comment)
- Delete: `lib/nowpayments.ts`, `app/api/webhooks/nowpayments/route.ts`, `app/(store)/dev/nowpayments/page.tsx`

**Interfaces:**
- Consumes: `createCryptoPayment`, `CryptoPaymentMethod` from `@/lib/heleket` (same names as the removed module).

- [ ] **Step 1: Swap the checkout import**

In `app/api/checkout/route.ts`, change line 7 from:

```ts
import { createCryptoPayment, type CryptoPaymentMethod } from "@/lib/nowpayments";
```

to:

```ts
import { createCryptoPayment, type CryptoPaymentMethod } from "@/lib/heleket";
```

(No other changes — the call site, `amount: subtotalUsd.toFixed(2)`, and `notes` string are unchanged.)

- [ ] **Step 2: Delete the NOWPayments files**

```bash
git rm lib/nowpayments.ts app/api/webhooks/nowpayments/route.ts "app/(store)/dev/nowpayments/page.tsx"
```

- [ ] **Step 3: Update `.env.example`**

Replace the NOWPayments block (lines 9-13):

```
# NOWPayments — for crypto payments (BTC, ETH, USDT, XMR)
# Obtain from https://nowpayments.io/
# Leave empty for dev mode (uses local simulator)
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
```

with:

```
# Heleket — for crypto payments (BTC, ETH, USDT, XMR)
# Obtain from your Heleket merchant dashboard (Merchant UUID + Payment API key).
# Leave HELEKET_MERCHANT_ID empty for dev mode (uses the local simulator).
HELEKET_MERCHANT_ID=
HELEKET_PAYMENT_API_KEY=
```

- [ ] **Step 4: Update the CSP comment in `next.config.js`**

Change the comment on lines 19-20 from:

```js
      // Crypto checkout redirects the browser (top-level navigation) to the
      // NOWPayments hosted page, so no extra connect/frame hosts are needed.
```

to:

```js
      // Crypto checkout redirects the browser (top-level navigation) to the
      // Heleket hosted page, so no extra connect/frame hosts are needed.
```

- [ ] **Step 5: Verify no NOWPayments imports remain and the smoke test still passes**

Run: `grep -rn "@/lib/nowpayments" app lib scripts ; echo "exit: $?"`
Expected: no matches (`grep` exit 1 → printed `exit: 1`).

Run: `DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts`
Expected: PASS — `All smoke checks passed.`

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build completes; route list shows `/api/webhooks/heleket` and `/dev/heleket`, and no `/api/webhooks/nowpayments` or `/dev/nowpayments`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: route crypto checkout through Heleket, remove NOWPayments

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update provider-name copy, comments, and docs

**Files (replace the literal "NOWPayments" with "Heleket"):**
- Modify: `config/brand.ts:31`
- Modify: `app/(store)/privacy/page.tsx:27`
- Modify: `app/(store)/products/[slug]/page.tsx:87`
- Modify: `app/(store)/page.tsx:36`
- Modify: `components/PaymentMethods.tsx:38`
- Modify: `lib/affiliate.ts:6` (comment)
- Modify: `README.md`, `CRYPTO_IMPLEMENTATION.md`, `CRYPTO_SETUP.md`, `CRYPTO_QUICKSTART.md`

- [ ] **Step 1: Update user-facing copy and the code comment**

Make these exact replacements:

- `config/brand.ts:31` — `secureLine: "Crypto payments processed securely via NOWPayments.",` → `secureLine: "Crypto payments processed securely via Heleket.",`
- `app/(store)/privacy/page.tsx:27` — `...processed by our payment provider (NOWPayments) on...` → `...processed by our payment provider (Heleket) on...`
- `app/(store)/products/[slug]/page.tsx:87` — `...processed securely through NOWPayments, with a 10% discount...` → `...processed securely through Heleket, with a 10% discount...`
- `app/(store)/page.tsx:36` — `...processed securely through NOWPayments, with a 10% discount...` → `...processed securely through Heleket, with a 10% discount...`
- `components/PaymentMethods.tsx:38` — `🔒 All payments processed securely via NOWPayments.` → `🔒 All payments processed securely via Heleket.`
- `lib/affiliate.ts:6` — `// ONLY from the NOWPayments webhook (order → paid), never client-side.` → `// ONLY from the Heleket webhook (order → paid), never client-side.`

- [ ] **Step 2: Update the provider-setup docs**

In `README.md`, `CRYPTO_IMPLEMENTATION.md`, `CRYPTO_SETUP.md`, and `CRYPTO_QUICKSTART.md`, replace NOWPayments references with Heleket: the provider name, the env var names (`NOWPAYMENTS_API_KEY`/`NOWPAYMENTS_IPN_SECRET` → `HELEKET_MERCHANT_ID`/`HELEKET_PAYMENT_API_KEY`), the signup URL (`https://nowpayments.io/` → `https://heleket.com/`), the API endpoint (`api.nowpayments.io/v1/invoice` → `api.heleket.com/v1/payment`), the webhook path (`/api/webhooks/nowpayments` → `/api/webhooks/heleket`), the dev-simulator path (`/dev/nowpayments` → `/dev/heleket`), and the signature description (HMAC-SHA512 IPN header → md5(base64(body)+payment key) in the body). Read each file first; preserve surrounding structure.

- [ ] **Step 3: Confirm no source references remain**

Run: `grep -rni "nowpayments" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md" -I | grep -v node_modules | grep -v "/.next/" | grep -v "docs/superpowers/specs/2026-06-12" | grep -v "docs/superpowers/plans/2026-06-12" | grep -v "docs/CLAUDE.md"`
Expected: no matches. (The 2026-06-12 specs/plans and `docs/CLAUDE.md` are historical records and intentionally retain the old name; the 2026-06-17 spec/plan reference NOWPayments only to describe what is being replaced, which is correct.)

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build completes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: rename payment provider copy and setup docs to Heleket

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: End-to-end manual verification in dev

**Files:** none (verification only).

- [ ] **Step 1: Ensure dev/mock mode**

Confirm `HELEKET_MERCHANT_ID` is unset in `.env.local` (remove any stale `NOWPAYMENTS_*` lines while there — `.env.local` is gitignored, not committed). With no merchant ID, the app uses the local simulator.

- [ ] **Step 2: Run the app**

Run: `npm run dev`
Open the store, add a product to the cart, go to checkout, choose a coin (try XMR and USDT), and submit.
Expected: redirect to `/dev/heleket?invoice=hl_…` showing the order, method, and amount.

- [ ] **Step 3: Simulate success**

Click "Simulate successful payment".
Expected: redirect to `/order-confirmation/<id>` showing "Payment confirmed"; the order is `paid` in the admin; stock decremented; if a `?ref=` cookie was set, a pending commission appears for that affiliate.

- [ ] **Step 4: Simulate failure on a fresh order**

Repeat checkout, then click "Simulate failed payment".
Expected: redirect to `/checkout?cancelled=1`; that order stays `pending`; stock unchanged.

- [ ] **Step 5: Final smoke + grep gate**

Run: `DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts`
Expected: `All smoke checks passed.`

Run the grep gate from Task 5 Step 3 once more.
Expected: no matches.

- [ ] **Step 6: (Optional, when real keys arrive) confirm live signature**

When `HELEKET_MERCHANT_ID`/`HELEKET_PAYMENT_API_KEY` are set, use Heleket's "test webhook" method (or a small real payment) to confirm `verifyHeleketSignature` accepts a genuine Heleket-signed webhook. If it rejects, the fallback (per the spec's risk section) is to verify against the raw request body string instead of a re-serialization.

---

## Self-Review

**Spec coverage:**
- Clean swap / remove NOWPayments → Tasks 1–4. ✓
- Same exported surface in `lib/heleket.ts` → Task 1 Interfaces. ✓
- Heleket create-payment request + response mapping (`result.url`/`result.uuid`) → Task 1 Step 3. ✓
- Webhook reads `sign` from body, `paid`/`paid_over` success, ports paid-path unchanged → Task 2. ✓
- Shared canonical signer + slash-escaping (Decision 2) → Task 1 `canonicalJson`/`makeSign`. ✓
- Parity / generic invoice (Decision 1) — no `currencies` field in payload → Task 1 Step 3 payload. ✓
- Dev simulator keyed on `HELEKET_MERCHANT_ID`, `hl_` prefix → Task 3. ✓
- Keep all four coins; enum unchanged → Global Constraints (no task touches the enum). ✓
- `.env.example`, CSP comment, copy/docs → Tasks 4–5. ✓
- Smoke-script verification (no test runner) → Tasks 1–2, run again in 4–6. ✓
- Risk mitigation: live-signature confirmation + raw-body fallback → Task 6 Step 6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `createCryptoPayment`, `verifyHeleketSignature`, `signHeleketWebhook`, `CryptoPaymentMethod`, `CreateCryptoPaymentResult` are used with identical names/signatures across Task 1 (definition), Task 2 (webhook + smoke), Task 3 (simulator), and Task 4 (checkout import). `canonicalJson`/`makeSign` are internal to `lib/heleket.ts`. ✓
