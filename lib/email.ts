import { brand } from "@/config/brand";
import { canonicalOrigin } from "@/lib/site-url";

// Transactional email via a self-hosted Postal server (HTTP API).
// Without POSTAL_URL + POSTAL_API_KEY (local dev), emails are logged
// to the server console instead — never in production.

const from = process.env.EMAIL_FROM ?? `${brand.name} <noreply@example.com>`;

/**
 * Email is enabled only when a Postal server is fully configured. With either
 * var blank the app runs normally and email-dependent flows (password reset)
 * are hidden. No mail host is ever assumed as a default.
 */
export function emailEnabled(): boolean {
  return Boolean(process.env.POSTAL_URL && process.env.POSTAL_API_KEY);
}

export async function send(to: string, subject: string, html: string) {
  const baseUrl = process.env.POSTAL_URL;
  const apiKey = process.env.POSTAL_API_KEY;
  if (!baseUrl || !apiKey) {
    if (process.env.NODE_ENV !== "production") {
      // Dev: surface the email body so flows are testable without a mail server.
      console.log(`[dev email] to=${to} subject="${subject}"\n${html}`);
    } else if (Boolean(baseUrl) !== Boolean(apiKey)) {
      // Exactly one var set — almost certainly a misconfiguration, not an opt-out.
      console.warn(
        `[email] ${baseUrl ? "POSTAL_API_KEY" : "POSTAL_URL"} is missing — email is disabled. Set both, or leave both blank to disable email intentionally.`
      );
    }
    // Both blank → email intentionally disabled → stay silent.
    return;
  }
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/send/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Server-API-Key": apiKey,
      },
      body: JSON.stringify({ to: [to], from, subject, html_body: html }),
    });
    const body = await res.json().catch(() => null);
    // Postal returns HTTP 200 even on failure; the real result is in body.status
    if (!res.ok || body?.status !== "success") {
      console.error("[email] Postal send failed", res.status, JSON.stringify(body?.data ?? body));
    }
  } catch (err) {
    console.error("[email] Postal send failed", err);
  }
}

export function layout(body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b2b24">
    <h2 style="color:${brand.primaryColor}">${brand.name}</h2>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#6b7a72">${brand.name} · ${brand.contact.email}</p>
  </div>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${canonicalOrigin()}/auth/verify?token=${token}`;
  await send(
    to,
    `Verify your ${brand.name} account`,
    layout(`<p>Welcome! Please confirm your email address to activate your affiliate dashboard.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Verify email</a></p>
      <p>Or copy this link: ${url}</p>`)
  );
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${canonicalOrigin()}/auth/reset-password?token=${token}`;
  await send(
    to,
    `Reset your ${brand.name} password`,
    layout(`<p>We received a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>`)
  );
}

export async function sendMasterPromotionEmail(to: string, referralCode: string) {
  const url = `${canonicalOrigin()}/auth/register?recruiter=${referralCode}`;
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
  const url = `${canonicalOrigin()}/auth/register?token=${token}`;
  await send(
    to,
    `You're invited to the ${brand.name} affiliate programme`,
    layout(`<p>You've been invited to join the ${brand.name} affiliate programme. This invite expires in 48 hours and can be used once.</p>
      <p><a href="${url}" style="background:${brand.primaryColor};color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none">Create your account</a></p>
      <p>Or copy this link: ${url}</p>`)
  );
}
