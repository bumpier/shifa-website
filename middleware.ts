import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

// Server-side gatekeeper for /admin/* and /dashboard, plus affiliate
// referral capture (?ref=CODE → 30-day cookie, last-click wins).

const REF_COOKIE = "ref_code";
const REF_MAX_AGE = 2_592_000; // 30 days
const ADMIN_SESSION_HOURS = 2;

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

async function validAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.admin === true;
  } catch {
    return false;
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
    if (!(await validAdminToken(token))) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Sliding expiry: re-issue so the session lasts 2h from last activity
    const res = NextResponse.next();
    const refreshed = await new SignJWT({ admin: true })
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
      const url = req.nextUrl.clone();
      url.pathname = "/auth/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // ── Referral capture: ?ref=CODE on any public page
  const ref = searchParams.get("ref");
  if (ref && /^[a-z0-9]{4,16}$/i.test(ref)) {
    const res = NextResponse.next();
    res.cookies.set(REF_COOKIE, ref.toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // must survive the redirect back from external links
      maxAge: REF_MAX_AGE,
      path: "/",
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)).*)"],
};
