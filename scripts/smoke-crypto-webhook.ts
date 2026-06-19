// Throwaway smoke test for the self-hosted crypto webhook receiver. Run with:
//   DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-crypto-webhook.ts
//
// Covers the two genuinely new pieces: the X-Webhook-Signature scheme
// (sign/verify over raw bytes — valid / tampered / missing header) and the
// confirmed-webhook → order transition, including idempotency on retry.

// Set the webhook secret before exercising the signer/verifier.
process.env.CRYPTO_WEBHOOK_SECRET = "smoke-test-secret";

import { prisma } from "../lib/db";
import { verifyWebhookSignature, signWebhookBody } from "../lib/crypto-gateway";
import { POST as cryptoWebhook } from "../app/api/crypto-webhook/route";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

const URL = "http://localhost:3000/api/crypto-webhook";

/** A request with a correctly-computed X-Webhook-Signature over the raw body. */
function signedRequest(payload: unknown): Request {
  const raw = JSON.stringify(payload);
  return new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signWebhookBody(raw) },
    body: raw,
  });
}

function confirmedPayload(orderId: string, over: Record<string, unknown> = {}) {
  return {
    event: "payment.confirmed",
    payment: {
      paymentId: "pay_smoke_1",
      orderId,
      currency: "BTC",
      amount: "0.001",
      wallet: "bc1qsmoke",
      status: "confirmed",
      txHash: "0xsmoketxhash",
      confirmations: 3,
      confirmationsRequired: 1,
      confirmedAt: "2026-06-18T00:00:00.000Z",
      ...over,
    },
  };
}

async function cleanup() {
  const orders = await prisma.order.findMany({
    where: { customerEmail: { contains: "smoke-crypto" } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  await prisma.affiliateReferral.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.emailLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { contains: "smoke-crypto" } } });
}

async function pendingOrder(email: string, refCode: string | null = null) {
  return prisma.order.create({
    data: {
      customerName: "Smoke Customer",
      customerEmail: email,
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]", // no items => no stock to decrement
      currency: "USD",
      totalAmount: 90,
      subtotalUsd: 90,
      paymentMethod: "btc",
      refCode,
      status: "pending",
    },
  });
}

async function main() {
  await cleanup();

  // ── 1) Signature scheme, over the RAW bytes ──────────────────────
  const raw = JSON.stringify(confirmedPayload("xyz"));
  const sig = signWebhookBody(raw);
  assert(verifyWebhookSignature(raw, sig), "valid signature verifies");
  assert(sig.startsWith("sha256="), "signature has sha256= prefix");
  // Tamper the body but keep the original signature — must fail.
  const tampered = raw.replace('"amount":"0.001"', '"amount":"9.999"');
  assert(tampered !== raw, "tampered body actually differs");
  assert(!verifyWebhookSignature(tampered, sig), "tampered body fails verification");
  assert(!verifyWebhookSignature(raw, null), "missing signature fails");
  assert(!verifyWebhookSignature(raw, "sha256=deadbeef"), "wrong signature fails");
  // Wrong secret produces a different signature for the same body.
  assert(signWebhookBody(raw, "other-secret") !== sig, "different secret => different signature");

  // ── 2) Affiliate + pending order with a referral code ────────────
  const affiliate = await prisma.user.create({
    data: {
      email: "aff.smoke-crypto@test.local",
      name: "Smoke Affiliate",
      passwordHash: "x",
      affiliateProfile: { create: { referralCode: "smokecry", commissionRate: 10 } },
    },
    include: { affiliateProfile: true },
  });
  assert(!!affiliate.affiliateProfile, "affiliate profile created");

  const order = await pendingOrder("customer.smoke-crypto@test.local", "smokecry");

  // ── 3) confirmed webhook flips pending → paid + records audit + commission ──
  const res = await cryptoWebhook(signedRequest(confirmedPayload(order.id)));
  assert(res.status === 200, "confirmed webhook returns 200");
  const paid = await prisma.order.findUnique({ where: { id: order.id } });
  assert(paid!.status === "paid", "order marked paid");
  assert(paid!.paymentRef === "pay_smoke_1", "paymentRef set to gateway paymentId");
  assert(paid!.paymentProvider === "shifapay", "paymentProvider recorded");
  const audit = JSON.parse(paid!.notes ?? "{}");
  assert(audit.txHash === "0xsmoketxhash", "txHash recorded in notes audit");
  assert(audit.amount === "0.001" && audit.currency === "BTC", "crypto amount + currency recorded");
  const refs = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs.length === 1 && refs[0]!.kind === "direct", "commission created");

  // ── 4) retry is a no-op (idempotent) ─────────────────────────────
  const retry = await cryptoWebhook(signedRequest(confirmedPayload(order.id)));
  assert(retry.status === 200, "retry returns 200");
  const refs2 = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs2.length === 1, "retry does not duplicate commission");

  // ── 5) missing signature header → 401, no state change ───────────
  const order2 = await pendingOrder("customer2.smoke-crypto@test.local");
  const noSigReq = new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(confirmedPayload(order2.id)),
  });
  const noSigRes = await cryptoWebhook(noSigReq);
  assert(noSigRes.status === 401, "missing signature rejected with 401");
  assert((await prisma.order.findUnique({ where: { id: order2.id } }))!.status === "pending",
    "order unchanged after missing signature");

  // ── 6) tampered body (valid sig for a DIFFERENT body) → 401 ──────
  const goodRaw = JSON.stringify(confirmedPayload(order2.id));
  const badReq = new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Signature": signWebhookBody(goodRaw) },
    body: goodRaw.replace('"amount":"0.001"', '"amount":"9.999"'),
  });
  const badRes = await cryptoWebhook(badReq);
  assert(badRes.status === 401, "tampered body rejected with 401");
  assert((await prisma.order.findUnique({ where: { id: order2.id } }))!.status === "pending",
    "order unchanged after tampered body");

  // ── 7) test ping (test:true) → 200, never fulfills ──────────────
  const pingRes = await cryptoWebhook(
    signedRequest({ event: "payment.confirmed", test: true, payment: confirmedPayload(order2.id).payment })
  );
  assert(pingRes.status === 200, "test ping returns 200");
  assert((await prisma.order.findUnique({ where: { id: order2.id } }))!.status === "pending",
    "test ping does not fulfill a real order");

  // ── 8) unknown orderId → 200 ack, no throw ──────────────────────
  const unknownRes = await cryptoWebhook(signedRequest(confirmedPayload("order_does_not_exist")));
  assert(unknownRes.status === 200, "unknown orderId acked with 200");

  // ── 9) non-confirmed status → 200 no-op ─────────────────────────
  const order3 = await pendingOrder("customer3.smoke-crypto@test.local");
  const pendingStatusRes = await cryptoWebhook(
    signedRequest(confirmedPayload(order3.id, { status: "pending" }))
  );
  assert(pendingStatusRes.status === 200, "non-confirmed status acked with 200");
  assert((await prisma.order.findUnique({ where: { id: order3.id } }))!.status === "pending",
    "non-confirmed status does not fulfill");

  await cleanup();
  console.log("\nAll smoke checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
