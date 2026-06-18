import { NextResponse } from "next/server";
import { verifyHeleketSignature } from "@/lib/heleket";
import { fulfillPaidOrder } from "@/lib/payments/fulfillment";

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

    await fulfillPaidOrder(orderId, { paymentRef: data.uuid, provider: "heleket" });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[heleket] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
