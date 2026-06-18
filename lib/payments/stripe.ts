import Stripe from "stripe";

// Lazily construct the client so importing this module never throws when keys
// are absent (dev mock mode, or crypto-only deployments).
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** All store currencies (AED, PKR, USD, GBP, EUR) are 2-decimal in Stripe. */
export function toMinorUnits(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

interface OrderItem {
  name: string;
  qty: number;
  unitPrice: string; // order-currency decimal string
}

/**
 * Create a hosted Stripe Checkout session for an order. In dev without a secret
 * key, returns the local /dev/stripe simulator URL instead (mirrors Heleket).
 */
export async function createStripeCheckout(
  order: { id: string; currency: string; items: string; customerEmail: string },
  origin: string
): Promise<{ paymentUrl: string; paymentRef: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    const ref = `cs_sim_${order.id.slice(0, 12)}`;
    return {
      paymentUrl: `${origin}/dev/stripe?session=${ref}&order=${order.id}`,
      paymentRef: ref,
    };
  }

  const items = JSON.parse(order.items) as OrderItem[];
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: items.map((i) => ({
      quantity: i.qty,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: toMinorUnits(i.unitPrice),
        product_data: { name: i.name },
      },
    })),
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    customer_email: order.customerEmail,
    success_url: `${origin}/order-confirmation/${order.id}`,
    cancel_url: `${origin}/checkout?cancelled=1`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { paymentUrl: session.url, paymentRef: session.id };
}

/** Verify a Stripe webhook against the raw request body. Throws on mismatch. */
export function verifyStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signature) throw new Error("Missing stripe-signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
