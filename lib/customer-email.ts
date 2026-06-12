import { createHmac } from "node:crypto";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { send, layout } from "@/lib/email";
import { brand, formatPrice, type Currency } from "@/config/brand";

// Customer-facing order emails. Every send is recorded in EmailLog first;
// the @@unique([orderId, type]) constraint makes double-sends impossible.
// Senders never throw — a Resend outage must not break a webhook or
// admin action. Callers fire-and-forget.

export type EmailType = "confirmation" | "shipped" | "delivered" | "nudge";

interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  qty: number;
  unitPrice: string;
  unitPriceAed: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

/** HMAC-signed unsubscribe link — no token storage needed. Reuses JWT_SECRET. */
export function unsubscribeSig(email: string): string {
  return createHmac("sha256", process.env.JWT_SECRET ?? "")
    .update(email.toLowerCase())
    .digest("hex");
}

export function unsubscribeUrl(email: string): string {
  const e = email.toLowerCase();
  return `${siteUrl()}/api/email/unsubscribe?email=${encodeURIComponent(e)}&sig=${unsubscribeSig(e)}`;
}

/**
 * Claim the EmailLog slot for (orderId, type), then send. Returns true if
 * this call sent the email, false if it was already sent or sending failed.
 */
async function logAndSend(
  order: Order,
  type: EmailType,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    await prisma.emailLog.create({
      data: { orderId: order.id, type, recipient: order.customerEmail },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false; // already sent
    console.error(`[email] log failed for order ${order.id} type ${type}`, err);
    return false;
  }
  try {
    await send(order.customerEmail, subject, html);
    return true;
  } catch (err) {
    console.error(`[email] send failed for order ${order.id} type ${type}`, err);
    return false;
  }
}

function itemsTable(items: OrderItem[], currency: Currency): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.name} × ${i.qty}</td>
         <td style="padding:6px 0;text-align:right">${formatPrice(
           parseFloat(i.unitPrice) * i.qty,
           currency
         )}</td></tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>`;
}

export async function sendOrderConfirmationEmail(order: Order): Promise<void> {
  const items = JSON.parse(order.items) as OrderItem[];
  const currency = order.currency as Currency;
  await logAndSend(
    order,
    "confirmation",
    `Your ${brand.name} order is confirmed`,
    layout(`<p>Hi ${order.customerName},</p>
      <p>Thanks for your order! Your payment has been received and we're getting it ready.</p>
      ${itemsTable(items, currency)}
      <p style="font-weight:bold">Total: ${formatPrice(order.totalAmount.toString(), currency)}</p>
      <p style="font-size:12px;color:#6b7a72">Order reference: ${order.id}</p>`)
  );
}

export async function sendOrderShippedEmail(order: Order): Promise<void> {
  await logAndSend(
    order,
    "shipped",
    `Your ${brand.name} order is on its way`,
    layout(`<p>Hi ${order.customerName},</p>
      <p>Good news — your order has been shipped and is on its way to you.</p>
      <p style="font-size:12px;color:#6b7a72">Order reference: ${order.id}</p>`)
  );
}

export async function sendOrderDeliveredEmail(order: Order): Promise<void> {
  await logAndSend(
    order,
    "delivered",
    `Your ${brand.name} order has been delivered`,
    layout(`<p>Hi ${order.customerName},</p>
      <p>Your order has been delivered. We hope you enjoy it!</p>
      <p style="font-size:12px;color:#6b7a72">Order reference: ${order.id}</p>`)
  );
}

/** items here are only the nudgeable ones (supplyDays > 0). */
export async function sendRepurchaseNudgeEmail(
  order: Order,
  items: OrderItem[]
): Promise<boolean> {
  const list = items
    .map(
      (i) =>
        `<li style="margin:6px 0"><a href="${siteUrl()}/products/${i.slug}" style="color:${brand.primaryColor}">${i.name}</a></li>`
    )
    .join("");
  return logAndSend(
    order,
    "nudge",
    `Running low? Time to restock your ${brand.name} favourites`,
    layout(`<p>Hi ${order.customerName},</p>
      <p>By our count, the products from your last order may be running low. Reorder before you run out:</p>
      <ul style="padding-left:18px">${list}</ul>
      <p><a href="${siteUrl()}/products" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Shop again</a></p>
      <p style="font-size:11px;color:#6b7a72;margin-top:24px">Don't want reminders like this?
        <a href="${unsubscribeUrl(order.customerEmail)}" style="color:#6b7a72">Unsubscribe</a></p>`)
  );
}
