"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentAffiliate } from "@/lib/auth";
import { encrypt } from "@/lib/encrypt";
import { BankDetailsSchema } from "@/lib/validation";
import type { FormState } from "@/app/(store)/auth/actions";

// Every action re-derives the affiliate from the session — an affiliate
// can never touch another affiliate's data.

export async function saveBankDetailsAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentAffiliate();
  if (!user?.affiliateProfile) return { error: "Session expired. Please sign in again." };

  const parsed = BankDetailsSchema.safeParse({
    bankName: formData.get("bankName"),
    bankAccountName: formData.get("bankAccountName"),
    bankAccountNumber: formData.get("bankAccountNumber"),
    bankIBAN: formData.get("bankIBAN") ?? "",
    bankCountry: formData.get("bankCountry"),
    payoutCurrency: formData.get("payoutCurrency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid bank details" };
  }
  const d = parsed.data;

  await prisma.affiliateProfile.update({
    where: { id: user.affiliateProfile.id },
    data: {
      // Encrypted at rest — AES-256-GCM
      bankName: encrypt(d.bankName),
      bankAccountName: encrypt(d.bankAccountName),
      bankAccountNumber: encrypt(d.bankAccountNumber),
      bankIBAN: d.bankIBAN ? encrypt(d.bankIBAN) : null,
      bankCountry: encrypt(d.bankCountry),
      payoutCurrency: d.payoutCurrency,
    },
  });

  revalidatePath("/dashboard");
  return { success: "Bank details saved." };
}

export async function requestPayoutAction(
  _prev: FormState,
  _formData: FormData
): Promise<FormState> {
  const user = await getCurrentAffiliate();
  const profile = user?.affiliateProfile;
  if (!profile) return { error: "Session expired. Please sign in again." };

  const minPayout = new Prisma.Decimal(process.env.AFFILIATE_MIN_PAYOUT_AED ?? "100");
  const balance = new Prisma.Decimal(profile.pendingBalance);

  if (balance.lessThan(minPayout)) {
    return { error: `Minimum payout is AED ${minPayout.toFixed(2)}.` };
  }
  if (!profile.bankAccountNumber) {
    return { error: "Add your bank details before requesting a payout." };
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
      currency: profile.payoutCurrency,
      status: "requested",
      // Snapshot of (encrypted) bank details at time of request
      bankSnapshot: JSON.stringify({
        bankName: profile.bankName,
        bankAccountName: profile.bankAccountName,
        bankAccountNumber: profile.bankAccountNumber,
        bankIBAN: profile.bankIBAN,
        bankCountry: profile.bankCountry,
      }),
    },
  });

  revalidatePath("/dashboard");
  return { success: "Payout requested. We will process it shortly." };
}
