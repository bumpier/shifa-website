import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { originFromHeaders } from "@/lib/site-url";

// Server-side gatekeeper for /admin/* and /dashboard, plus affiliate
// referral capture (?ref=CODE → 30-day cookie, last-click wins) and
// master recruit capture (?recruiter=CODE → 30-day cookie, read at signup).

const REF_COOKIE = "ref_code";
const RECRUIT_COOKIE = "recruit_code";
const REF_MAX_AGE = 2_592_000; // 30 days
const CODE_RE = /^[a-z0-9]{4,16}$/i;
const ADMIN_SESSION_HOURS = 2;

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

// Redirect within the same public origin the visitor is actually on.
// Next's middleware runtime requires an ABSOLUTE redirect URL, so we build one
// from originFromHeaders() — which prefers X-Forwarded-Host (forwarded by nginx)
// over the raw Host. Using req.nextUrl instead would leak the internal upstream
// host (localhost:3000) into the Location header.
function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, originFromHeaders(req.headers)));
}

async function getAdminTokenRole(
  token: string | undefined
): Promise<"ADMIN" | "PACKER" | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.admin !== true) return null;
    return (payload.role as string) === "PACKER" ? "PACKER" : "ADMIN";
  } catch {
    return null;
  }
}

async function validUserToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return !!payload.sub;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ── Admin protection (everything under /admin except the login page)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get("admin_session")?.value;
    const role = await getAdminTokenRole(token);

    if (!role) {
      return redirectTo(req, "/admin/login");
    }

    // Packers are restricted to /admin/orders and /admin/orders/*
    if (role === "PACKER" && !pathname.startsWith("/admin/orders")) {
      return redirectTo(req, "/admin/orders");
    }

    // Sliding expiry: re-issue token preserving role
    const res = NextResponse.next();
    const refreshPayload: Record<string, unknown> = { admin: true };
    if (role === "PACKER") refreshPayload.role = "PACKER";
    const refreshed = await new SignJWT(refreshPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
      .sign(secret());
    res.cookies.set("admin_session", refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: ADMIN_SESSION_HOURS * 3600,
      path: "/",
    });
    return res;
  }

  // ── Affiliate dashboard requires a valid session
  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("session")?.value;
    if (!(await validUserToken(token))) {
      return redirectTo(req, "/auth/login");
    }
  }

  // ── Referral capture: ?ref=CODE (sales) and ?recruiter=CODE (signups)
  const ref = searchParams.get("ref");
  const recruiter = searchParams.get("recruiter");
  const res = NextResponse.next();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // must survive the redirect back from external links
    maxAge: REF_MAX_AGE,
    path: "/",
  };
  if (ref && CODE_RE.test(ref)) {
    res.cookies.set(REF_COOKIE, ref.toLowerCase(), cookieOpts);
  }
  if (recruiter && CODE_RE.test(recruiter)) {
    res.cookies.set(RECRUIT_COOKIE, recruiter.toLowerCase(), cookieOpts);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)).*)"],
};
