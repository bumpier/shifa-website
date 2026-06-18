import { prisma } from "@/lib/db";
import { createReferralForPaidOrder } from "@/lib/affiliate";
import { sendOrderConfirmationEmail, sendNewOrderAlert } from "@/lib/customer-email";
import type { PaymentProvider } from "@/lib/payments/config";

// Single post-payment code path shared by every provider's webhook.
// Idempotent: only the pending → paid transition does work; retries are no-ops.
export async function fulfillPaidOrder(
  orderId: string,
  opts: { paymentRef?: string | null; provider: PaymentProvider }
): Promise<{ alreadyPaid: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { alreadyPaid: false }; // unknown order — caller acknowledges
  if (order.status !== "pending") return { alreadyPaid: true };

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "paid",
        paymentRef: opts.paymentRef ?? order.paymentRef,
        paymentProvider: opts.provider,
      },
    });
    // Decrement stock now that payment is confirmed.
    const items = JSON.parse(order.items) as { productId: string; qty: number }[];
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.qty } },
      });
    }
  });

  // Commission records are created ONLY here — webhook-driven.
  await createReferralForPaidOrder(orderId);

  const paidOrder = await prisma.order.findUnique({ where: { id: orderId } });
  if (paidOrder) {
    void sendOrderConfirmationEmail(paidOrder); // to the customer
    void sendNewOrderAlert(paidOrder); // to the shop owner (ORDER_NOTIFY_EMAIL)
  }
  return { alreadyPaid: false };
}
