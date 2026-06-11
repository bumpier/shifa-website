"use server";

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  createAdminSession,
  createAdminUserSession,
  destroyAdminSession,
  requireAdmin,
  requireAdminRole,
  verifyAdminPassword,
} from "@/lib/adminAuth";
import {
  clearFailures,
  isLockedOut,
  rateLimit,
  recordFailure,
} from "@/lib/rateLimit";
import { approveReferral, rejectReferral } from "@/lib/affiliate";
import { sendAffiliateInviteEmail } from "@/lib/email";
import { CommissionRateSchema, ProductSchema } from "@/lib/validation";
import { z } from "zod";
import type { FormState } from "@/app/(store)/auth/actions";

async function ip(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : "local";
}

// ── Session ──────────────────────────────────────────────────────

export async function adminLoginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const key = `admin-login:${await ip()}`;
  if (isLockedOut(key)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }
  if (!rateLimit(`${key}:req`, 10, 60_000)) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const emailRaw = formData.get("email");
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    recordFailure(key);
    return { error: "Invalid credentials" };
  }

  // AdminUser login (email provided)
  if (typeof emailRaw === "string" && emailRaw.trim()) {
    const email = emailRaw.trim().toLowerCase();
    const adminUser = await prisma.adminUser.findUnique({ where: { email } });
    if (
      !adminUser ||
      !adminUser.active ||
      !(await bcrypt.compare(password, adminUser.passwordHash))
    ) {
      recordFailure(key);
      return { error: "Invalid credentials" };
    }
    clearFailures(key);
    await createAdminUserSession(adminUser);
    redirect(adminUser.role === "PACKER" ? "/admin/orders" : "/admin");
  }

  // Env-var super-admin fallback (no email)
  if (!(await verifyAdminPassword(password))) {
    recordFailure(key);
    return { error: "Invalid credentials" };
  }
  clearFailures(key);
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ── Orders ───────────────────────────────────────────────────────

const orderStatusSchema = z.enum(["pending", "paid", "shipped", "delivered", "cancelled"]);

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.string().uuid().parse(formData.get("orderId"));
  const status = orderStatusSchema.parse(formData.get("status"));

  await prisma.order.update({ where: { id }, data: { status } });

  if (status === "cancelled") {
    const { rejectReferralForOrder } = await import("@/lib/affiliate");
    await rejectReferralForOrder(id);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

// ── Products ─────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function saveUploadedImage(file: File): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Only JPEG, PNG or WebP images are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5MB");

  // Random UUID filename — original name is never used (path traversal safe)
  const name = `${crypto.randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

export async function saveProductAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const parsed = ProductSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    priceAed: formData.get("priceAed"),
    pricePkr: formData.get("pricePkr"),
    priceUsd: formData.get("priceUsd"),
    priceGbp: formData.get("priceGbp"),
    priceEur: formData.get("priceEur"),
    stock: formData.get("stock"),
    weightGrams: formData.get("weightGrams"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid product details" };
  }
  const d = parsed.data;
  const productId = formData.get("productId");

  let imagePath: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    try {
      imagePath = await saveUploadedImage(image);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Image upload failed" };
    }
  }

  const data = {
    name: d.name,
    slug: d.slug,
    description: d.description,
    priceAed: d.priceAed,
    pricePkr: d.pricePkr,
    priceUsd: d.priceUsd,
    priceGbp: d.priceGbp,
    priceEur: d.priceEur,
    stock: d.stock,
    weightGrams: d.weightGrams,
    active: d.active,
  };

  try {
    if (typeof productId === "string" && productId) {
      const id = z.string().uuid().parse(productId);
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) return { error: "Product not found" };
      await prisma.product.update({
        where: { id },
        data: {
          ...data,
          images: imagePath ? JSON.stringify([imagePath]) : existing.images,
        },
      });
    } else {
      await prisma.product.create({
        data: { ...data, images: JSON.stringify(imagePath ? [imagePath] : []) },
      });
    }
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { error: "That slug is already in use" };
    }
    console.error("[internal] save product failed", err);
    return { error: "Something went wrong" };
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const id = z.string().uuid().parse(formData.get("productId"));
  // Soft delete — orders reference product data as a JSON snapshot
  await prisma.product.update({ where: { id }, data: { active: false } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

// ── Affiliates ───────────────────────────────────────────────────

export async function createInviteAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdminRole("ADMIN");

  const invite = await prisma.affiliateInvite.create({
    data: { expiresAt: new Date(Date.now() + 48 * 3600_000) },
  });

  const email = formData.get("email");
  if (typeof email === "string" && email.trim()) {
    const parsed = z.string().email().max(254).safeParse(email.trim());
    if (!parsed.success) return { error: "Invalid email address" };
    await sendAffiliateInviteEmail(parsed.data, invite.token);
  }

  revalidatePath("/admin/affiliates/invite");
  return {
    success: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/register?token=${invite.token}`,
  };
}

export async function setCommissionRateAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const affiliateId = z.string().uuid().parse(formData.get("affiliateId"));
  const parsed = CommissionRateSchema.parse({ rate: formData.get("rate") });
  await prisma.affiliateProfile.update({
    where: { id: affiliateId },
    data: { commissionRate: new Prisma.Decimal(parsed.rate) },
  });
  revalidatePath(`/admin/affiliates/${affiliateId}`);
}

export async function setAffiliateStatusAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const userId = z.string().uuid().parse(formData.get("userId"));
  const status = z.enum(["active", "suspended"]).parse(formData.get("status"));
  await prisma.user.update({ where: { id: userId }, data: { status } });
  revalidatePath("/admin/affiliates");
}

export async function reviewReferralAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const referralId = z.string().uuid().parse(formData.get("referralId"));
  const decision = z.enum(["approve", "reject"]).parse(formData.get("decision"));
  if (decision === "approve") await approveReferral(referralId);
  else await rejectReferral(referralId);
  revalidatePath("/admin/affiliates");
}

export async function processPayoutAction(formData: FormData): Promise<void> {
  await requireAdminRole("ADMIN");
  const payoutId = z.string().uuid().parse(formData.get("payoutId"));
  const decision = z.enum(["paid", "rejected", "processing"]).parse(formData.get("decision"));
  const note = formData.get("adminNote");
  const adminNote =
    typeof note === "string" && note.trim() ? note.trim().slice(0, 500) : null;

  await prisma.$transaction(async (tx) => {
    const payout = await tx.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!payout || payout.status === "paid" || payout.status === "rejected") return;

    await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: decision,
        adminNote,
        processedAt: decision === "processing" ? null : new Date(),
      },
    });

    if (decision === "paid") {
      await tx.affiliateProfile.update({
        where: { id: payout.affiliateId },
        data: {
          pendingBalance: { decrement: payout.amount },
          totalPaid: { increment: payout.amount },
        },
      });
      // Mark the approved referrals covered by this payout as paid
      await tx.affiliateReferral.updateMany({
        where: { affiliateId: payout.affiliateId, status: "approved" },
        data: { status: "paid" },
      });
    }
  });

  revalidatePath("/admin/affiliates");
}
