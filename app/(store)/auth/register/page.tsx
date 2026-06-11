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
  let validToken: string | undefined;

  if (token && z.string().uuid().safeParse(token).success) {
    const invite = await prisma.affiliateInvite.findUnique({ where: { token } });
    if (invite && !invite.usedAt && invite.expiresAt > new Date()) {
      validToken = token;
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Affiliate programme</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
          Create your account
        </h1>
        <RegisterForm token={validToken} />
      </div>
    </div>
  );
}
