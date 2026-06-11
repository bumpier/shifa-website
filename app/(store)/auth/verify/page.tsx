import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let verified = false;

  if (token && /^[a-f0-9]{48}$/.test(token)) {
    const user = await prisma.user.findUnique({ where: { verifyToken: token } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), verifyToken: null },
      });
      verified = true;
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
      <div className="card p-8">
        {verified ? (
          <>
            <p className="eyebrow">All set</p>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
              Email verified
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              Your account is fully active. Sign in to open your affiliate dashboard.
            </p>
            <Link href="/auth/login" className="btn-primary mt-8 w-full">
              Sign in
            </Link>
          </>
        ) : (
          <>
            <p className="eyebrow">Verification</p>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
              Link invalid
            </h1>
            <p className="mt-3 text-sm text-ink-soft">
              This verification link is invalid or was already used. If your email is
              already verified, just sign in. Otherwise you can request a new link from
              your dashboard.
            </p>
            <Link href="/auth/login" className="btn-secondary mt-8 w-full">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
