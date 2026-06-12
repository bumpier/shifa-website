import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { masterSalesThreshold } from "@/lib/affiliate";
import { formatUsdt } from "@/config/brand";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  await requireAdmin();

  const [affiliates, pendingReview, confirmedCounts] = await Promise.all([
    prisma.affiliateProfile.findMany({
      include: {
        user: true,
        _count: { select: { referrals: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.affiliateReferral.count({
      where: { status: "pending", kind: "direct" },
    }),
    prisma.affiliateReferral.groupBy({
      by: ["affiliateId"],
      where: { kind: "direct", status: { in: ["approved", "paid"] } },
      _count: true,
    }),
  ]);

  const threshold = masterSalesThreshold();
  const confirmedByAffiliate = new Map(confirmedCounts.map((c) => [c.affiliateId, c._count]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Partner programme</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
            Affiliates
          </h1>
          {pendingReview > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              {pendingReview} commission{pendingReview === 1 ? "" : "s"} awaiting review.
            </p>
          )}
        </div>
        <Link href="/admin/affiliates/invite" className="btn-primary">
          Invite affiliate
        </Link>
      </div>

      {affiliates.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-sm text-ink-soft">
          No affiliates yet. Send your first invite.
        </p>
      ) : (
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Affiliate</th>
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-5 py-3 font-semibold">Rate</th>
                <th className="px-5 py-3 font-semibold">Referrals</th>
                <th className="px-5 py-3 font-semibold">Tier</th>
                <th className="px-5 py-3 font-semibold">Pending balance</th>
                <th className="px-5 py-3 font-semibold">Total earned</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {affiliates.map((a) => (
                <tr key={a.id} className="hover:bg-brand-tint/40">
                  <td className="px-5 py-3">
                    <p className="font-medium">{a.user.name}</p>
                    <p className="text-xs text-ink-soft">{a.user.email}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{a.referralCode}</td>
                  <td className="px-5 py-3">{a.commissionRate.toString()}%</td>
                  <td className="px-5 py-3">{a._count.referrals}</td>
                  <td className="px-5 py-3">
                    {a.isMaster ? (
                      <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                        Master
                      </span>
                    ) : (confirmedByAffiliate.get(a.id) ?? 0) >= threshold ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Eligible
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">
                        {confirmedByAffiliate.get(a.id) ?? 0}/{threshold}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">{formatUsdt(a.pendingBalance.toString())}</td>
                  <td className="px-5 py-3">{formatUsdt(a.totalEarned.toString())}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        a.user.status === "active"
                          ? "bg-brand-tint text-brand-deep"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {a.user.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/affiliates/${a.id}`}
                      className="text-sm font-semibold text-brand hover:text-brand-deep"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
