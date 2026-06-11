import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Referral tracking + commission lifecycle. Commissions are created
// ONLY from the Paykassma webhook (order → paid), never client-side.

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no lookalikes

export function generateReferralCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return code;
}

export async function uniqueReferralCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateReferralCode();
    const exists = await prisma.affiliateProfile.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

/**
 * Called when an order transitions to `paid` (webhook only).
 * Creates a pending commission for the referring affiliate, in AED,
 * based on the AED subtotal computed at order time.
 */
export async function createReferralForPaidOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.refCode) return;

  const existing = await prisma.affiliateReferral.findUnique({ where: { orderId } });
  if (existing) return; // webhook retries must not double-create

  const profile = await prisma.affiliateProfile.findUnique({
    where: { referralCode: order.refCode },
    include: { user: true },
  });
  if (!profile || profile.user.status !== "active") return;

  const rate = new Prisma.Decimal(profile.commissionRate);
  const commissionAed = new Prisma.Decimal(order.subtotalAed).mul(rate).div(100).toDecimalPlaces(2);

  await prisma.affiliateReferral.create({
    data: {
      affiliateId: profile.id,
      orderId: order.id,
      orderTotal: order.totalAmount,
      currency: order.currency,
      commissionRate: rate,
      commissionAmount: commissionAed,
      commissionAmountAed: commissionAed,
      status: "pending",
    },
  });
}

/** Admin approves a pending commission — moves it into the balance. */
export async function approveReferral(referralId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ref = await tx.affiliateReferral.findUnique({ where: { id: referralId } });
    if (!ref || ref.status !== "pending") return;
    await tx.affiliateReferral.update({
      where: { id: referralId },
      data: { status: "approved" },
    });
    await tx.affiliateProfile.update({
      where: { id: ref.affiliateId },
      data: {
        totalEarned: { increment: ref.commissionAmountAed },
        pendingBalance: { increment: ref.commissionAmountAed },
      },
    });
  });
}

export async function rejectReferral(referralId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ref = await tx.affiliateReferral.findUnique({ where: { id: referralId } });
    if (!ref) return;
    if (ref.status === "approved") {
      // claw back from balance if it was already approved
      await tx.affiliateProfile.update({
        where: { id: ref.affiliateId },
        data: {
          totalEarned: { decrement: ref.commissionAmountAed },
          pendingBalance: { decrement: ref.commissionAmountAed },
        },
      });
    }
    if (ref.status === "pending" || ref.status === "approved") {
      await tx.affiliateReferral.update({
        where: { id: referralId },
        data: { status: "rejected" },
      });
    }
  });
}

/** Auto-reject pending commissions when an order is cancelled/refunded. */
export async function rejectReferralForOrder(orderId: string): Promise<void> {
  const ref = await prisma.affiliateReferral.findUnique({ where: { orderId } });
  if (ref && (ref.status === "pending" || ref.status === "approved")) {
    await rejectReferral(ref.id);
  }
}
