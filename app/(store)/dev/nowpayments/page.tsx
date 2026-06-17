import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatPrice, type Currency } from "@/config/brand";
import { requestOrigin } from "@/lib/site-url";
import { signNowpaymentsWebhook } from "@/lib/nowpayments";

export const dynamic = "force-dynamic";

function simulatorEnabled(): boolean {
  return !process.env.NOWPAYMENTS_API_KEY;
}

async function deliverWebhook(invoiceId: string, confirmed: boolean) {
  "use server";
  if (!simulatorEnabled()) return;

  const orderId = invoiceId.replace("np_", "");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) notFound();

  const body = JSON.stringify({
    type: confirmed ? "invoice_paid" : "invoice_expired",
    invoice_id: invoiceId,
    order_id: order.id,
    payment_status: confirmed ? "finished" : "failed",
  });

  await fetch(`${await requestOrigin()}/api/webhooks/nowpayments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-NOWPAYMENTS-SIG": signNowpaymentsWebhook(body),
    },
    body,
    cache: "no-store",
  });

  redirect(confirmed ? `/order-confirmation/${order.id}` : "/checkout?cancelled=1");
}

export default async function NowpaymentsSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  if (!simulatorEnabled()) notFound();
  const { invoice: invoiceId } = await searchParams;
  if (!invoiceId?.startsWith("np_")) notFound();

  const orderId = invoiceId.replace("np_", "");
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
          Simulates the NOWPayments payment page. Choosing an outcome sends a
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
