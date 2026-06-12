import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────
// Paykassma integration — the ONLY file that talks to Paykassma.
//
// Paykassma's docs are not public; the endpoint path, payload field
// names and signing method below follow their standard hosted-redirect
// pattern but MUST be confirmed against the merchant documentation you
// receive after approval. Everything configurable is read from env.
//
// Without an API key and with PAYKASSMA_ENV=sandbox, a local payment
// simulator (/dev/paykassma) stands in for the hosted page so the full
// checkout → webhook → confirmation flow can be exercised in dev.
// ─────────────────────────────────────────────────────────────────

export type PaymentMethod = "card" | "jazzcash" | "easypaisa" | "btc" | "eth" | "usdt" | "xmr";

export interface CreatePaymentInput {
  orderId: string;
  amount: string; // decimal string
  currency: string;
  method: PaymentMethod;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface CreatePaymentResult {
  paymentUrl: string;
  paymentRef: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function isSimulatorMode(): boolean {
  return process.env.PAYKASSMA_ENV !== "production" && !process.env.PAYKASSMA_API_KEY;
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  if (isSimulatorMode()) {
    return {
      paymentUrl: `${siteUrl()}/dev/paykassma?order=${input.orderId}`,
      paymentRef: `sim_${input.orderId.slice(0, 8)}`,
    };
  }

  const apiUrl = process.env.PAYKASSMA_API_URL;
  const apiKey = process.env.PAYKASSMA_API_KEY;
  const merchantId = process.env.PAYKASSMA_MERCHANT_ID;
  const secretKey = process.env.PAYKASSMA_SECRET_KEY;
  if (!apiUrl || !apiKey || !merchantId || !secretKey) {
    throw new Error("Paykassma environment variables are not fully configured");
  }

  // NOTE: confirm exact endpoint + field names with Paykassma's merchant docs
  const payload = {
    merchant_id: merchantId,
    order_id: input.orderId,
    amount: input.amount,
    currency: input.currency,
    payment_method: input.method,
    customer: {
      name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
    },
    success_url: `${siteUrl()}/order-confirmation/${input.orderId}`,
    cancel_url: `${siteUrl()}/checkout?cancelled=1`,
    webhook_url: `${siteUrl()}/api/webhooks/paykassma`,
  };

  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secretKey).update(body).digest("hex");

  const res = await fetch(`${apiUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Signature": signature,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    // Never leak gateway responses to the client — log server-side only
    console.error("[paykassma] create payment failed", res.status, await res.text());
    throw new Error("Payment gateway error");
  }

  const data = (await res.json()) as { payment_url?: string; payment_id?: string };
  if (!data.payment_url || !data.payment_id) {
    throw new Error("Payment gateway returned an unexpected response");
  }
  return { paymentUrl: data.payment_url, paymentRef: data.payment_id };
}

/**
 * Verify a webhook signature (HMAC-SHA256 of the raw body, hex).
 * Confirm the exact signing method/header name with Paykassma's docs.
 */
export function verifyPaykassmaSignature(payload: string, signature: string): boolean {
  const secretKey = process.env.PAYKASSMA_SECRET_KEY;
  if (!secretKey || !signature) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Sign a payload the same way Paykassma would — used by the dev simulator. */
export function signWebhookPayload(payload: string): string {
  const secretKey = process.env.PAYKASSMA_SECRET_KEY;
  if (!secretKey) throw new Error("PAYKASSMA_SECRET_KEY not set");
  return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
}
