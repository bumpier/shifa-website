import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyNowpaymentsSignature } from "@/lib/nowpayments";
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

    // Mark order as paid
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: "paid" },
    });
    void sendOrderConfirmationEmail(order);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[nowpayments] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
