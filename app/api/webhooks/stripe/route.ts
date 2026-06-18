import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyStripeEvent } from "@/lib/payments/stripe";
import { fulfillPaidOrder } from "@/lib/payments/fulfillment";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyStripeEvent(raw, signature);
  } catch (err) {
    console.error("[stripe] webhook signature verification failed", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      // Guard against async payment methods that complete later as "unpaid".
      if (session.payment_status === "paid") {
        const orderId = session.metadata?.orderId ?? session.client_reference_id ?? undefined;
        if (orderId) {
          const paymentRef =
            typeof session.payment_intent === "string" ? session.payment_intent : session.id;
          await fulfillPaidOrder(orderId, { paymentRef, provider: "stripe" });
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe] webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
