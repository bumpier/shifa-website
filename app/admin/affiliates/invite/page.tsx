import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InviteAffiliatePage() {
  await requireAdmin();

  const openInvites = await prisma.affiliateInvite.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Partner programme</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Invite an affiliate
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Invites are single-use and expire after 48 hours. Generate a link to share
        yourself (WhatsApp, etc.), or enter an email to send it directly.
      </p>

      <div className="card mt-8 p-8">
        <InviteForm />
      </div>

      {openInvites.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-medium text-brand-deep">
            Unused invites
          </h2>
          <div className="card mt-4 divide-y divide-line">
            {openInvites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-mono text-xs text-ink-soft">
                  …register?token={inv.token.slice(0, 13)}…
                </span>
                <span className="text-xs text-ink-soft">
                  expires{" "}
                  {inv.expiresAt.toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
