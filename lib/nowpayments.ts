import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────
// NOWPayments integration for crypto payments (BTC, ETH, USDT, XMR)
//
// API docs: https://documenter.getpostman.com/view/7907941/S1a32RSP
// Webhook: POST to /api/webhooks/nowpayments
//
// Environment variables required:
// - NOWPAYMENTS_API_KEY
// - NOWPAYMENTS_IPN_SECRET (for webhook signature verification)
// ─────────────────────────────────────────────────────────────────

export type CryptoPaymentMethod = "btc" | "eth" | "usdt" | "xmr";

export interface CreateCryptoPaymentInput {
  orderId: string;
  amount: string; // decimal string in USD
  method: CryptoPaymentMethod;
  customerName: string;
  customerEmail: string;
}

export interface CreateCryptoPaymentResult {
  paymentUrl: string;
  paymentRef: string;
  invoiceId: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function isMockMode(): boolean {
  return !process.env.NOWPAYMENTS_API_KEY;
}

// Map our payment method names to NOWPayments coin codes
function getCryptoCurrency(method: CryptoPaymentMethod): string {
  const map: Record<CryptoPaymentMethod, string> = {
    btc: "BTC",
    eth: "ETH",
    usdt: "USDT",
    xmr: "XMR",
  };
  return map[method];
}

export async function createCryptoPayment(
  input: CreateCryptoPaymentInput
): Promise<CreateCryptoPaymentResult> {
  // In development without API key, return mock payment URL
  if (isMockMode()) {
    const mockInvoiceId = `np_${input.orderId.slice(0, 12)}`;
    return {
      paymentUrl: `${siteUrl()}/dev/nowpayments?invoice=${mockInvoiceId}`,
      paymentRef: mockInvoiceId,
      invoiceId: mockInvoiceId,
    };
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    throw new Error("NOWPayments API key is not configured");
  }

  const cryptoCurrency = getCryptoCurrency(input.method);

  // NOWPayments invoice creation
  const payload = {
    price_amount: parseFloat(input.amount),
    price_currency: "usd",
    order_id: input.orderId,
    order_description: `Order #${input.orderId.slice(0, 8)}`,
    ipn_callback_url: `${siteUrl()}/api/webhooks/nowpayments`,
    success_url: `${siteUrl()}/order-confirmation/${input.orderId}`,
    cancel_url: `${siteUrl()}/checkout?cancelled=1`,
    is_fixed_rate: false,
    is_fee_paid_by_user: false,
  };

  const response = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[nowpayments] create invoice failed", response.status, error);
    throw new Error("Crypto payment gateway error");
  }

  const data = (await response.json()) as {
    invoice_url?: string;
    id?: string;
  };

  if (!data.invoice_url || !data.id) {
    console.error("[nowpayments] unexpected response", data);
    throw new Error("Crypto payment gateway returned unexpected response");
  }

  return {
    paymentUrl: data.invoice_url,
    paymentRef: data.id,
    invoiceId: data.id,
  };
}

/**
 * Verify NOWPayments IPN (Instant Payment Notification) signature.
 * Signature is HMAC-SHA512 of the raw body using the IPN secret.
 */
export function verifyNowpaymentsSignature(payload: string, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac("sha512", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Sign a payload the same way NOWPayments would — used by the dev simulator.
 */
export function signNowpaymentsWebhook(payload: string): string {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) throw new Error("NOWPAYMENTS_IPN_SECRET not set");
  return crypto.createHmac("sha512", secret).update(payload).digest("hex");
}
