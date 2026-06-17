import crypto from "crypto";
import { canonicalOrigin } from "./site-url";

// ─────────────────────────────────────────────────────────────────
// Heleket integration for crypto payments (BTC, ETH, USDT, XMR)
//
// API docs: https://doc.heleket.com/
// Create payment: POST https://api.heleket.com/v1/payment
// Webhook: POST to /api/webhooks/heleket (sign is in the body, no header)
//
// Environment variables required:
// - HELEKET_MERCHANT_ID      (merchant UUID; unset => local mock mode)
// - HELEKET_PAYMENT_API_KEY  (payment API key; signs requests + verifies webhooks)
// ─────────────────────────────────────────────────────────────────

export type CryptoPaymentMethod = "btc" | "eth" | "usdt" | "xmr";

export interface CreateCryptoPaymentInput {
  orderId: string;
  amount: string; // decimal string in USD, e.g. "90.00"
  method: CryptoPaymentMethod;
  customerName: string;
  customerEmail: string;
  // Origin of the storefront domain the customer is on — used for the browser
  // redirect (success/cancel) URLs so they return to the same site.
  origin: string;
}

export interface CreateCryptoPaymentResult {
  paymentUrl: string;
  paymentRef: string;
  invoiceId: string;
}

function isMockMode(): boolean {
  return !process.env.HELEKET_MERCHANT_ID;
}

/**
 * Serialize exactly the way Heleket's PHP backend does: json_encode escapes
 * forward slashes ("/" -> "\/"); JS JSON.stringify does not. Both the request
 * signer and the webhook verifier MUST use this so signatures match.
 */
function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj).replace(/\//g, "\\/");
}

/** Heleket sign = md5( base64(canonicalJson(data)) + paymentApiKey ). */
function makeSign(obj: unknown, key: string): string {
  const base64 = Buffer.from(canonicalJson(obj), "utf8").toString("base64");
  return crypto.createHash("md5").update(base64 + key).digest("hex");
}

export async function createCryptoPayment(
  input: CreateCryptoPaymentInput
): Promise<CreateCryptoPaymentResult> {
  // In development without a merchant ID, return a local mock payment URL.
  if (isMockMode()) {
    const mockInvoiceId = `hl_${input.orderId.slice(0, 12)}`;
    return {
      paymentUrl: `${input.origin}/dev/heleket?invoice=${mockInvoiceId}`,
      paymentRef: mockInvoiceId,
      invoiceId: mockInvoiceId,
    };
  }

  const merchantId = process.env.HELEKET_MERCHANT_ID;
  const apiKey = process.env.HELEKET_PAYMENT_API_KEY;
  if (!merchantId || !apiKey) {
    throw new Error("Heleket credentials are not configured");
  }

  const payload = {
    amount: input.amount,
    currency: "USD",
    order_id: input.orderId,
    // Server-to-server callback must reach us regardless of which storefront
    // domain the customer used — pin it to the stable canonical origin.
    url_callback: `${canonicalOrigin()}/api/webhooks/heleket`,
    // Browser redirects return the customer to the domain they checked out on.
    url_return: `${input.origin}/checkout?cancelled=1`,
    url_success: `${input.origin}/order-confirmation/${input.orderId}`,
  };

  // The signed string MUST be the exact body we send.
  const body = canonicalJson(payload);
  const sign = makeSign(payload, apiKey);

  const response = await fetch("https://api.heleket.com/v1/payment", {
    method: "POST",
    headers: {
      merchant: merchantId,
      sign,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[heleket] create payment failed", response.status, error);
    throw new Error("Crypto payment gateway error");
  }

  const data = (await response.json()) as {
    result?: { uuid?: string; url?: string };
  };

  if (!data.result?.url || !data.result?.uuid) {
    console.error("[heleket] unexpected response", data);
    throw new Error("Crypto payment gateway returned unexpected response");
  }

  return {
    paymentUrl: data.result.url,
    paymentRef: data.result.uuid,
    invoiceId: data.result.uuid,
  };
}

/**
 * Verify a Heleket webhook. Heleket embeds `sign` in the JSON body (no header):
 * sign = md5( base64(json_encode(body_without_sign)) + paymentApiKey ).
 */
export function verifyHeleketSignature(
  parsed: Record<string, unknown>,
  sign: string | undefined
): boolean {
  const key = process.env.HELEKET_PAYMENT_API_KEY;
  if (!key || !sign) return false;

  const { sign: _omit, ...data } = parsed;
  const expected = makeSign(data, key);

  const a = Buffer.from(expected);
  const b = Buffer.from(sign);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Sign a webhook body the same way Heleket would — used by the dev simulator
 * and the smoke test. Reads HELEKET_PAYMENT_API_KEY.
 */
export function signHeleketWebhook(data: Record<string, unknown>): string {
  const key = process.env.HELEKET_PAYMENT_API_KEY;
  if (!key) throw new Error("HELEKET_PAYMENT_API_KEY not set");
  return makeSign(data, key);
}
