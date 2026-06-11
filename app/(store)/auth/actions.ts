"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { uniqueReferralCode } from "@/lib/affiliate";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
} from "@/lib/validation";
import {
  clearFailures,
  isLockedOut,
  rateLimit,
  recordFailure,
} from "@/lib/rateLimit";

export type FormState = { error?: string; success?: string };

async function ip(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : "local";
}

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!rateLimit(`register:${await ip()}`, 5, 60_000)) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const rawToken = formData.get("token");
  const parsed = RegisterSchema.safeParse({
    token: typeof rawToken === "string" && rawToken ? rawToken : undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid details" };
  }
  const { token, name, email, password } = parsed.data;

  const invite = token
    ? await prisma.affiliateInvite.findUnique({ where: { token } })
    : null;

  if (token && (!invite || invite.usedAt || invite.expiresAt < new Date())) {
    return { error: "This invite link is invalid or has expired." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const referralCode = await uniqueReferralCode();
  const defaultRate = parseFloat(process.env.AFFILIATE_DEFAULT_COMMISSION ?? "10");

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "affiliate",
        affiliateProfile: {
          create: { referralCode, commissionRate: defaultRate },
        },
      },
    });
    if (invite) {
      await tx.affiliateInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedByUserId: created.id },
      });
    }
    return created;
  });

  return { success: "Account created. You can now sign in." };
}

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const key = `login:${await ip()}`;
  if (isLockedOut(key)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }
  if (!rateLimit(`${key}:req`, 10, 60_000)) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid credentials" };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Same generic message whether the email or password is wrong
  if (!user || user.status !== "active") {
    recordFailure(key);
    return { error: "Invalid credentials" };
  }
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    recordFailure(key);
    return { error: "Invalid credentials" };
  }

  clearFailures(key);
  await createSession(user.id, user.role);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/auth/login");
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!rateLimit(`forgot:${await ip()}`, 5, 60_000)) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Please enter a valid email address." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && user.status === "active") {
    const resetToken = crypto.randomBytes(24).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExp: new Date(Date.now() + 3600_000) },
    });
    await sendPasswordResetEmail(user.email, resetToken);
  }

  // Identical response whether or not the account exists
  return { success: "If that email is registered, a reset link is on its way." };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!rateLimit(`reset:${await ip()}`, 5, 60_000)) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const parsed = ResetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid request" };
  }

  const user = await prisma.user.findUnique({
    where: { resetToken: parsed.data.token },
  });
  if (!user || !user.resetTokenExp || user.resetTokenExp < new Date()) {
    return { error: "This reset link is invalid or has expired." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      resetToken: null,
      resetTokenExp: null,
    },
  });

  return { success: "Password updated. You can now sign in." };
}

export async function resendVerificationAction(): Promise<void> {
  // Used from the dashboard's "verify your email" prompt
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return;
  if (!rateLimit(`resend:${session.sub}`, 3, 600_000)) return;

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || user.emailVerifiedAt) return;

  let token = user.verifyToken;
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: token } });
  }
  await sendVerificationEmail(user.email, token);
}
