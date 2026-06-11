import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Affiliate/customer session handling — JWT in httpOnly cookie, 24h expiry.

const SESSION_COOKIE = "session";
const SESSION_HOURS = 24;

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be at least 32 chars");
  return new TextEncoder().encode(s);
}

export type SessionPayload = { sub: string; role: string };

export async function createSession(userId: string, role: string) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_HOURS * 3600,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { sub: payload.sub, role: (payload.role as string) ?? "affiliate" };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Loads the current user and affiliate profile, enforcing active status
 * and email verification. Returns null if any check fails — callers
 * redirect to login. Affiliates can only ever reach their own data
 * because everything is keyed off this session lookup.
 */
export async function getCurrentAffiliate() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { affiliateProfile: true },
  });
  if (!user || user.status !== "active" || !user.affiliateProfile) return null;
  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
