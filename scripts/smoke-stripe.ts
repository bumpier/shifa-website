// Throwaway smoke test for the Stripe payment integration. Run with:
//   DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-stripe.ts
//
// Uses Stripe's generateTestHeaderString to sign a real checkout.session.completed
// event, then drives the webhook route end-to-end (verify → fulfill → idempotency).

process.env.STRIPE_SECRET_KEY = "sk_test_smoke";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_smoke";
process.env.STRIPE_ENABLED = "true";

import Stripe from "stripe";
import { prisma } from "../lib/db";
import { getPaymentConfig } from "../lib/payments/config";
import { POST as stripeWebhook } from "../app/api/webhooks/stripe/route";

const stripe = new Stripe("sk_test_smoke");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

function signedRequest(orderId: string, paymentIntent: string): Request {
  const event = {
    id: "evt_test",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: paymentIntent,
        client_reference_id: orderId,
        metadata: { orderId },
      },
    },
  };
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_smoke",
  });
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

async function cleanup() {
  const orders = await prisma.order.findMany({
    where: { customerEmail: { contains: "smoke-stripe" } },
    select: { id: true },
  });
  const ids = orders.map((o) => o.id);
  await prisma.affiliateReferral.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.emailLog.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { contains: "smoke-stripe" } } });
}

async function main() {
  await cleanup();

  // 1) Config gating
  assert(getPaymentConfig().methods.includes("card"), "card method enabled when stripe configured");

  // 2) Affiliate + pending card order with a referral code
  await prisma.user.create({
    data: {
      email: "aff.smoke-stripe@test.local",
      name: "Smoke Affiliate",
      passwordHash: "x",
      affiliateProfile: { create: { referralCode: "smokestr", commissionRate: 10 } },
    },
  });

  const order = await prisma.order.create({
    data: {
      customerName: "Smoke Customer",
      customerEmail: "customer.smoke-stripe@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]",
      currency: "USD",
      totalAmount: 90,
      subtotalUsd: 90,
      paymentMethod: "card",
      paymentProvider: "stripe",
      refCode: "smokestr",
      status: "pending",
    },
  });

  // 3) Signed event flips pending → paid and creates a commission
  const res = await stripeWebhook(signedRequest(order.id, "pi_smoke_1"));
  assert(res.status === 200, "valid stripe webhook returns 200");
  const paid = await prisma.order.findUnique({ where: { id: order.id } });
  assert(paid!.status === "paid", "order marked paid");
  assert(paid!.paymentRef === "pi_smoke_1", "paymentRef set to payment_intent");
  assert(paid!.paymentProvider === "stripe", "paymentProvider set to stripe");
  const refs = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs.length === 1 && refs[0]!.kind === "direct", "commission created");

  // 4) Retry is a no-op (idempotent)
  const res2 = await stripeWebhook(signedRequest(order.id, "pi_smoke_1"));
  assert(res2.status === 200, "retry returns 200 (no error on replay)");
  const refs2 = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs2.length === 1, "retry does not duplicate commission");

  // 5) Bad signature is rejected and does not change state
  const order2 = await prisma.order.create({
    data: {
      customerName: "Smoke Customer 2",
      customerEmail: "customer2.smoke-stripe@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]",
      currency: "USD",
      totalAmount: 50,
      subtotalUsd: 50,
      paymentMethod: "card",
      paymentProvider: "stripe",
      status: "pending",
    },
  });
  const badReq = new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: JSON.stringify({ type: "checkout.session.completed" }),
  });
  const badRes = await stripeWebhook(badReq);
  assert(badRes.status === 400, "bad signature rejected with 400");
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
