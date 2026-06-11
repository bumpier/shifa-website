import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatPrice, type Currency } from "@/config/brand";
import { signWebhookPayload } from "@/lib/paykassma";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────
// DEV-ONLY payment simulator. Stands in for Paykassma's hosted page
// when PAYKASSMA_ENV=sandbox and no API key is configured, so the
// full checkout → signed webhook → confirmation flow can be tested.
// Returns 404 in any other configuration.
// ─────────────────────────────────────────────────────────────────

function simulatorEnabled(): boolean {
  return process.env.PAYKASSMA_ENV !== "production" && !process.env.PAYKASSMA_API_KEY;
}

async function deliverWebhook(orderId: string, status: "paid" | "failed") {
  "use server";
  if (!simulatorEnabled()) return;

  const body = JSON.stringify({
    event: "payment.update",
    order_id: orderId,
    payment_id: `sim_${orderId.slice(0, 8)}`,
    status,
  });
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/paykassma`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature": signWebhookPayload(body),
    },
    body,
    cache: "no-store",
  });
  redirect(status === "paid" ? `/order-confirmation/${orderId}` : "/checkout?cancelled=1");
}

export default async function PaymentSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  if (!simulatorEnabled()) notFound();
  const { order: orderId } = await searchParams;
  if (!z.string().uuid().safeParse(orderId).success) notFound();

  const order = await prisma.order.findUnique({ where: { id: orderId! } });
  if (!order) notFound();

  const payAction = deliverWebhook.bind(null, order.id, "paid" as const);
  const failAction = deliverWebhook.bind(null, order.id, "failed" as const);

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Sandbox · not a real payment page</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-brand-deep">
          Paykassma simulator
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Simulates the hosted Paykassma payment page. Choosing an outcome sends a
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
              className="w-full rounded-full border border-red-200 px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Simulate failed payment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
