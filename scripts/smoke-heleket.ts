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
