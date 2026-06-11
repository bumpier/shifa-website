import Link from "next/link";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let inviteValid = false;

  if (token && z.string().uuid().safeParse(token).success) {
    const invite = await prisma.affiliateInvite.findUnique({ where: { token } });
    inviteValid = !!invite && !invite.usedAt && invite.expiresAt > new Date();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Affiliate programme</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
          Create your account
        </h1>

        {inviteValid ? (
          <RegisterForm token={token!} />
        ) : (
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-soft">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              This invite link is invalid, already used, or has expired.
            </p>
            <p>
              Invites expire 48 hours after they are issued and can only be used once.
              Please ask for a new invite link.
            </p>
            <p>
              Already registered?{" "}
              <Link href="/auth/login" className="text-brand hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
