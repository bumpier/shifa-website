"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentAffiliate } from "@/lib/auth";
import { encrypt } from "@/lib/encrypt";
import { WalletSchema } from "@/lib/validation";
import type { FormState } from "@/app/(store)/auth/actions";

// Every action re-derives the affiliate from the session — an affiliate
// can never touch another affiliate's data.

export async function saveWalletAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentAffiliate();
  if (!user?.affiliateProfile) return { error: "Session expired. Please sign in again." };

  const parsed = WalletSchema.safeParse({ usdtAddress: formData.get("usdtAddress") });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid wallet address" };
  }

  await prisma.affiliateProfile.update({
    where: { id: user.affiliateProfile.id },
    data: {
      // Encrypted at rest — AES-256-GCM
      usdtAddress: encrypt(parsed.data.usdtAddress),
    },
  });

  revalidatePath("/dashboard");
  return { success: "Wallet address saved." };
}

export async function requestPayoutAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const user = await getCurrentAffiliate();
  const profile = user?.affiliateProfile;
  if (!profile) return { error: "Session expired. Please sign in again." };

  const minPayout = new Prisma.Decimal(process.env.AFFILIATE_MIN_PAYOUT_USDT ?? "25");
  const balance = new Prisma.Decimal(profile.pendingBalance);

  if (balance.lessThan(minPayout)) {
    return { error: `Minimum payout is ${minPayout.toFixed(2)} USDT.` };
  }
  if (!profile.usdtAddress) {
    return { error: "Add your USDT (TRC20) wallet address before requesting a payout." };
  }

  const open = await prisma.payoutRequest.findFirst({
    where: { affiliateId: profile.id, status: { in: ["requested", "processing"] } },
  });
  if (open) {
    return { error: "You already have a payout request in progress." };
  }

  await prisma.payoutRequest.create({
    data: {
      affiliateId: profile.id,
      amount: balance,
      currency: "USDT",
      status: "requested",
      // Snapshot of the (encrypted) wallet at time of request
      walletSnapshot: JSON.stringify({
        usdtAddress: profile.usdtAddress,
        network: "TRC20",
      }),
    },
  });

  revalidatePath("/dashboard");
  return {
    success: "Payout requested. Payouts are processed manually and sent within 24–48 hours.",
  };
}
