import { Resend } from "resend";
import { brand } from "@/config/brand";

// Transactional email via Resend. Without RESEND_API_KEY (local dev),
// links are logged to the server console instead — never in production.

const from = process.env.EMAIL_FROM ?? `${brand.name} <onboarding@resend.dev>`;

async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev email] to=${to} subject="${subject}"\n${html}`);
    } else {
      console.error("[email] RESEND_API_KEY missing — email not sent");
    }
    return;
  }
  const resend = new Resend(key);
  await resend.emails.send({ from, to, subject, html });
}

function layout(body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b2b24">
    <h2 style="color:${brand.primaryColor}">${brand.name}</h2>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#6b7a72">${brand.name} · ${brand.contact.email}</p>
  </div>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/verify?token=${token}`;
  await send(
    to,
    `Verify your ${brand.name} account`,
    layout(`<p>Welcome! Please confirm your email address to activate your affiliate dashboard.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Verify email</a></p>
      <p>Or copy this link: ${url}</p>`)
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?token=${token}`;
  await send(
    to,
    `Reset your ${brand.name} password`,
    layout(`<p>We received a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>`)
  );
}

export async function sendMasterPromotionEmail(to: string, referralCode: string) {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/register?recruiter=${referralCode}`;
  await send(
    to,
    `You're now a ${brand.name} Master affiliate`,
    layout(`<p>Congratulations! You've been promoted to <strong>Master affiliate</strong>.</p>
      <p>You can now recruit your own affiliates. Anyone who joins through your personal link below becomes part of your team, and you'll earn an extra commission on every confirmed sale they generate — on top of their own earnings.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Your recruit link</a></p>
      <p>Or copy this link: ${url}</p>
      <p>Your full team overview is available in your affiliate dashboard.</p>`)
  );
}

export async function sendAffiliateInviteEmail(to: string, token: string) {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/register?token=${token}`;
  await send(
    to,
    `You're invited to the ${brand.name} affiliate programme`,
    layout(`<p>You've been invited to join the ${brand.name} affiliate programme. This invite expires in 48 hours and can be used once.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Create your account</a></p>
      <p>Or copy this link: ${url}</p>`)
  );
}
