// Throwaway smoke test for the middleware auth redirects. Run with:
//   npx tsx scripts/smoke-middleware-redirect.ts
//
// Guards the fix for the /admin → localhost:3000 redirect leak: the middleware
// must emit a RELATIVE Location so the browser stays on whatever public domain
// it's already on, regardless of the (internal) host the app actually sees.
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "../middleware";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

process.env.JWT_SECRET = "smoke-secret";
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Build a request whose host is the INTERNAL upstream — the exact value that
// used to leak into the redirect. A correct relative Location must not contain it.
function req(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`http://127.0.0.1:3000${path}`), { headers });
}

async function packerToken(): Promise<string> {
  return new SignJWT({ admin: true, role: "PACKER" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
}

async function run() {
  // 1. Unauthenticated /admin → relative /admin/login
  {
    const res = await middleware(req("/admin"));
    assert(res.status === 307, "unauth /admin returns 307");
    assert(
      res.headers.get("location") === "/admin/login",
      "unauth /admin → relative /admin/login (no host leak)"
    );
  }

  // 2. Packer hitting a non-orders admin page → relative /admin/orders
  {
    const token = await packerToken();
    const res = await middleware(req("/admin", `admin_session=${token}`));
    assert(res.status === 307, "packer /admin returns 307");
    assert(
      res.headers.get("location") === "/admin/orders",
      "packer /admin → relative /admin/orders"
    );
  }

  // 3. Unauthenticated /dashboard → relative /auth/login
  {
    const res = await middleware(req("/dashboard"));
    assert(res.status === 307, "unauth /dashboard returns 307");
    assert(
      res.headers.get("location") === "/auth/login",
      "unauth /dashboard → relative /auth/login"
    );
  }

  // 4. The core regression guard: no redirect may carry the internal host.
  for (const path of ["/admin", "/dashboard"]) {
    const loc = (await middleware(req(path))).headers.get("location") ?? "";
    assert(
      !loc.includes("127.0.0.1") && !loc.includes("localhost"),
      `${path} redirect Location carries no internal host`
    );
  }

  console.log("\nAll middleware-redirect assertions passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
