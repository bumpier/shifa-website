import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPaykassmaSignature } from "@/lib/paykassma";
import { createReferralForPaidOrder, rejectReferralForOrder } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

// Paykassma payment webhook. Signature is verified on the RAW body
// before anything is parsed; unverified requests are rejected.
// Confirm the exact header name + event field names with Paykassma docs.

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-signature") ?? req.headers.get("x-paykassma-signature") ?? "";

    if (!verifyPaykassmaSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: { event?: string; order_id?: string; payment_id?: string; status?: string };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const orderId = event.order_id;
    const status = event.status ?? event.event;
    if (!orderId || typeof orderId !== "string" || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      // Acknowledge so the gateway stops retrying an unknown reference
      return NextResponse.json({ ok: true });
    }

    if (["paid", "success", "completed"].includes(status)) {
      if (order.status === "pending") {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: "paid",
              paykassmaRef: event.payment_id ?? order.paykassmaRef,
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
      }
    } else if (["failed", "cancelled", "refunded", "chargeback"].includes(status)) {
      if (order.status === "pending" || (order.status === "paid" && status !== "failed")) {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "cancelled" },
        });
        await rejectReferralForOrder(orderId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[internal] webhook error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
