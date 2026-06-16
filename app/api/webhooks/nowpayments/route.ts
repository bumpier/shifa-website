import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyNowpaymentsSignature } from "@/lib/nowpayments";
import { createReferralForPaidOrder } from "@/lib/affiliate";
import { sendOrderConfirmationEmail } from "@/lib/customer-email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("X-NOWPAYMENTS-SIG");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await req.text();

  if (!verifyNowpaymentsSignature(body, signature)) {
    console.error("[nowpayments] webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const data = JSON.parse(body) as {
      type?: string;
      order_id?: string;
      payment_id?: string | number;
      payment_status?: string;
    };

    if (data.type !== "invoice_paid") {
      // Only process confirmed payments
      return NextResponse.json({ ok: true });
    }

    const orderId = data.order_id;
    if (!orderId) {
      console.error("[nowpayments] webhook missing order_id");
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
            paymentRef: data.payment_id != null ? String(data.payment_id) : order.paymentRef,
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
    console.error("[nowpayments] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
