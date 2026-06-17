import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Referral tracking + commission lifecycle. Commissions are created
// ONLY from the Heleket webhook (order → paid), never client-side.
//
// Pyramid: each direct commission may carry one "override" sibling row —
// the recruiting master's cut, paid by the house on top of the recruit's
// commission. Overrides are one level deep only and always change state
// together with their parent direct row (approve/reject/clawback).

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no lookalikes

export function masterOverridePercent(): number {
  const v = parseFloat(process.env.MASTER_OVERRIDE_PERCENT ?? "2.5");
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 2.5;
}

export function masterSalesThreshold(): number {
  const v = parseInt(process.env.MASTER_SALES_THRESHOLD ?? "10", 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

/** Confirmed sales = direct commissions an admin has approved (or paid). */
export async function countConfirmedSales(affiliateId: string): Promise<number> {
  return prisma.affiliateReferral.count({
    where: { affiliateId, kind: "direct", status: { in: ["approved", "paid"] } },
  });
}

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
 * Creates a pending commission for the referring affiliate, in USDT,
 * based on the USD subtotal computed at order time (USDT is USD-pegged).
 */
export async function createReferralForPaidOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.refCode) return;

  const existing = await prisma.affiliateReferral.findFirst({
    where: { orderId, kind: "direct" },
  });
  if (existing) return; // webhook retries must not double-create

  const profile = await prisma.affiliateProfile.findUnique({
    where: { referralCode: order.refCode },
    include: { user: true, recruiter: { include: { user: true } } },
  });
  if (!profile || profile.user.status !== "active") return;

  const rate = new Prisma.Decimal(profile.commissionRate);
  const commissionUsdt = new Prisma.Decimal(order.subtotalUsd).mul(rate).div(100).toDecimalPlaces(2);

  // Master status is checked NOW: a demoted/suspended master earns no
  // override on orders paid after demotion, even from existing recruits.
  const recruiter = profile.recruiter;
  const overrideRate = new Prisma.Decimal(masterOverridePercent());
  const overrideUsdt = new Prisma.Decimal(order.subtotalUsd)
    .mul(overrideRate)
    .div(100)
    .toDecimalPlaces(2);
  const payOverride =
    !!recruiter && recruiter.isMaster && recruiter.user.status === "active";

  await prisma.$transaction(async (tx) => {
    const direct = await tx.affiliateReferral.create({
      data: {
        affiliateId: profile.id,
        orderId: order.id,
        orderTotal: order.totalAmount,
        currency: order.currency,
        commissionRate: rate,
        commissionAmountUsdt: commissionUsdt,
        status: "pending",
      },
    });
    if (payOverride) {
      await tx.affiliateReferral.create({
        data: {
          affiliateId: recruiter.id,
          orderId: order.id,
          orderTotal: order.totalAmount,
          currency: order.currency,
          commissionRate: overrideRate,
          commissionAmountUsdt: overrideUsdt,
          status: "pending",
          kind: "override",
          parentReferralId: direct.id,
        },
      });
    }
  });
}

type Tx = Prisma.TransactionClient;
type Referral = Prisma.AffiliateReferralGetPayload<Record<string, never>>;

async function approveInTx(tx: Tx, ref: Referral): Promise<void> {
  if (ref.status !== "pending") return;
  await tx.affiliateReferral.update({
    where: { id: ref.id },
    data: { status: "approved" },
  });
  await tx.affiliateProfile.update({
    where: { id: ref.affiliateId },
    data: {
      totalEarned: { increment: ref.commissionAmountUsdt },
      pendingBalance: { increment: ref.commissionAmountUsdt },
    },
  });
}

async function rejectInTx(tx: Tx, ref: Referral): Promise<void> {
  if (ref.status === "approved") {
    // claw back from balance if it was already approved
    await tx.affiliateProfile.update({
      where: { id: ref.affiliateId },
      data: {
        totalEarned: { decrement: ref.commissionAmountUsdt },
        pendingBalance: { decrement: ref.commissionAmountUsdt },
      },
    });
  }
  if (ref.status === "pending" || ref.status === "approved") {
    await tx.affiliateReferral.update({
      where: { id: ref.id },
      data: { status: "rejected" },
    });
  }
}

/**
 * Admin approves a pending commission — moves it into the balance.
 * Approving a direct commission also approves its override sibling
 * (the master's cut) in the same transaction; overrides are never
 * approved on their own.
 */
export async function approveReferral(referralId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ref = await tx.affiliateReferral.findUnique({
      where: { id: referralId },
      include: { overrideReferral: true },
    });
    if (!ref || ref.kind !== "direct") return;
    await approveInTx(tx, ref);
    if (ref.overrideReferral) await approveInTx(tx, ref.overrideReferral);
  });
}

/** Rejecting a direct commission also rejects (and claws back) its override. */
export async function rejectReferral(referralId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const ref = await tx.affiliateReferral.findUnique({
      where: { id: referralId },
      include: { overrideReferral: true },
    });
    if (!ref || ref.kind !== "direct") return;
    await rejectInTx(tx, ref);
    if (ref.overrideReferral) await rejectInTx(tx, ref.overrideReferral);
  });
}

/** Auto-reject pending commissions when an order is cancelled/refunded. */
export async function rejectReferralForOrder(orderId: string): Promise<void> {
  const ref = await prisma.affiliateReferral.findFirst({
    where: { orderId, kind: "direct" },
  });
  if (ref && (ref.status === "pending" || ref.status === "approved")) {
    await rejectReferral(ref.id);
  }
}
