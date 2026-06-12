import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentAffiliate } from "@/lib/auth";
import { countConfirmedSales, masterSalesThreshold, masterOverridePercent } from "@/lib/affiliate";
import { tryDecrypt } from "@/lib/encrypt";
import { convertFromAed, formatPrice, type Currency } from "@/config/brand";
import { logoutAction } from "@/app/(store)/auth/actions";
import { CopyButton } from "@/components/CopyButton";
import { BankDetailsForm, PayoutButton } from "./DashboardForms";

export const dynamic = "force-dynamic";

const REFERRAL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-brand-tint text-brand-deep",
  paid: "bg-brand text-white",
  rejected: "bg-red-50 text-red-600",
};

export default async function DashboardPage() {
  const user = await getCurrentAffiliate();
  if (!user?.affiliateProfile) redirect("/auth/login");
  const profile = user.affiliateProfile;


  const [referrals, payouts, confirmedSales, recruits, overrides] = await Promise.all([
    prisma.affiliateReferral.findMany({
      where: { affiliateId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.payoutRequest.findMany({
      where: { affiliateId: profile.id },
      orderBy: { requestedAt: "desc" },
      take: 10,
    }),
    countConfirmedSales(profile.id),
    profile.isMaster
      ? prisma.affiliateProfile.findMany({
          where: { recruiterId: profile.id },
          include: {
            user: { select: { name: true } },
            _count: {
              select: {
                referrals: {
                  where: { kind: "direct", status: { in: ["approved", "paid"] } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    profile.isMaster
      ? prisma.affiliateReferral.findMany({
          where: { affiliateId: profile.id, kind: "override", status: { in: ["approved", "paid"] } },
          include: { parentReferral: { select: { affiliateId: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Override earnings per recruit (the recruit owns the parent direct row)
  const overrideByRecruit = new Map<string, number>();
  let overrideTotal = 0;
  for (const o of overrides) {
    const amount = parseFloat(o.commissionAmountAed.toString());
    overrideTotal += amount;
    const recruitId = o.parentReferral?.affiliateId;
    if (recruitId) {
      overrideByRecruit.set(recruitId, (overrideByRecruit.get(recruitId) ?? 0) + amount);
    }
  }

  const threshold = masterSalesThreshold();
  const overridePercent = masterOverridePercent();
  const recruitLink = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/register?recruiter=${profile.referralCode}`;

  const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL}/?ref=${profile.referralCode}`;
  const minPayout = parseFloat(process.env.AFFILIATE_MIN_PAYOUT_AED ?? "100");
  const pending = parseFloat(profile.pendingBalance.toString());
  const hasBank = !!profile.bankAccountNumber;

  const pc = profile.payoutCurrency as Currency;
  const fmt = (aed: number | string) => formatPrice(convertFromAed(aed, pc), pc);

  const stats = [
    { label: "Total referrals", value: String(referrals.length) },
    { label: "Total earned", value: fmt(profile.totalEarned.toString()) },
    { label: "Pending balance", value: fmt(profile.pendingBalance.toString()) },
    { label: "Paid out", value: fmt(profile.totalPaid.toString()) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Affiliate dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-brand-deep">
            Welcome, {user.name.split(" ")[0]}
          </h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-ink-soft hover:text-brand">
            Sign out
          </button>
        </form>
      </div>

      {/* Referral link */}
      <div className="card mt-8 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Your referral link</p>
          <p className="truncate font-mono text-sm text-ink">{referralLink}</p>
          <p className="mt-1 text-xs text-ink-soft">
            You earn {profile.commissionRate.toString()}% of every order placed through this
            link, paid out in {pc}.
          </p>
        </div>
        <CopyButton text={referralLink} />
      </div>

      {/* Master programme */}
      {profile.isMaster ? (
        <div className="card mt-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow mb-2">
                Master affiliate · your recruit link
              </p>
              <p className="truncate font-mono text-sm text-ink">{recruitLink}</p>
              <p className="mt-1 text-xs text-ink-soft">
                Affiliates who join through this link become part of your team. You earn an
                extra {overridePercent}% on every confirmed sale they generate — on top of
                their own commission.
              </p>
            </div>
            <CopyButton text={recruitLink} />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Your team · {recruits.length} recruit{recruits.length === 1 ? "" : "s"} ·{" "}
              {fmt(overrideTotal)} earned
            </p>
            {recruits.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">
                No recruits yet. Share your recruit link to start building your team.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                      <th className="py-2 pr-5 font-semibold">Recruit</th>
                      <th className="py-2 pr-5 font-semibold">Joined</th>
                      <th className="py-2 pr-5 font-semibold">Confirmed sales</th>
                      <th className="py-2 font-semibold">Your earnings ({pc})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {recruits.map((rec) => (
                      <tr key={rec.id}>
                        <td className="py-2.5 pr-5 font-medium">{rec.user.name}</td>
                        <td className="py-2.5 pr-5 text-ink-soft">
                          {new Intl.DateTimeFormat("en-GB").format(rec.createdAt)}
                        </td>
                        <td className="py-2.5 pr-5">{rec._count.referrals}</td>
                        <td className="py-2.5 font-medium">
                          {fmt(overrideByRecruit.get(rec.id) ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Become a Master affiliate</p>
              <p className="text-sm text-ink-soft">
                Reach {threshold} confirmed sales to unlock your own recruit link and earn an
                extra {overridePercent}% on every sale your recruits make.
              </p>
            </div>
            <p className="font-display text-2xl font-medium text-brand-deep">
              {Math.min(confirmedSales, threshold)} / {threshold}
            </p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-tint">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, (confirmedSales / threshold) * 100)}%` }}
            />
          </div>
          {confirmedSales >= threshold && (
            <p className="mt-3 text-xs font-semibold text-brand-deep">
              You've hit the target! Your promotion is being reviewed.
            </p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {s.label}
            </p>
            <p className="mt-2 font-display text-2xl font-medium text-brand-deep">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {/* Referrals */}
          <section>
            <h2 className="font-display text-xl font-medium text-brand-deep">Recent referrals</h2>
            {referrals.length === 0 ? (
              <p className="card mt-4 p-6 text-sm text-ink-soft">
                No referrals yet. Share your link to get started.
              </p>
            ) : (
              <div className="card mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 font-semibold">Order value</th>
                      <th className="px-5 py-3 font-semibold">Commission ({pc})</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {referrals.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 text-ink-soft">
                          {new Intl.DateTimeFormat("en-GB").format(r.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          {r.kind === "override" ? (
                            <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-deep">
                              team
                            </span>
                          ) : (
                            <span className="text-xs text-ink-soft">direct</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {formatPrice(r.orderTotal.toString(), r.currency as never)}
                        </td>
                        <td className="px-5 py-3 font-medium">
                          {fmt(r.commissionAmountAed.toString())}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${REFERRAL_STATUS_STYLES[r.status] ?? ""}`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Payout history */}
          <section>
            <h2 className="font-display text-xl font-medium text-brand-deep">Payout history</h2>
            {payouts.length === 0 ? (
              <p className="card mt-4 p-6 text-sm text-ink-soft">No payouts yet.</p>
            ) : (
              <div className="card mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                      <th className="px-5 py-3 font-semibold">Requested</th>
                      <th className="px-5 py-3 font-semibold">Amount</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payouts.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3 text-ink-soft">
                          {new Intl.DateTimeFormat("en-GB").format(p.requestedAt)}
                        </td>
                        <td className="px-5 py-3 font-medium">
                          {formatPrice(p.amount.toString(), p.currency as Currency)}
                        </td>
                        <td className="px-5 py-3 capitalize text-ink-soft">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Payout request */}
          <div className="card p-6">
            <p className="eyebrow mb-3">Request a payout</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              Your approved balance is{" "}
              <span className="font-semibold text-brand-deep">
                {fmt(profile.pendingBalance.toString())}
              </span>
              . Minimum payout is {fmt(minPayout)}.
            </p>
            <PayoutButton disabled={pending < minPayout || !hasBank} />
            {!hasBank && (
              <p className="mt-3 text-xs text-amber-700">
                Add your bank details below to enable payouts.
              </p>
            )}
          </div>

          {/* Bank details */}
          <div className="card p-6">
            <p className="eyebrow mb-3">Bank details</p>
            <p className="mb-5 text-xs leading-relaxed text-ink-soft">
              Used for bank-transfer payouts. Stored encrypted.
            </p>
            <BankDetailsForm
              defaults={{
                bankName: tryDecrypt(profile.bankName) ?? "",
                bankAccountName: tryDecrypt(profile.bankAccountName) ?? "",
                bankAccountNumber: tryDecrypt(profile.bankAccountNumber) ?? "",
                bankIBAN: tryDecrypt(profile.bankIBAN) ?? "",
                bankCountry: tryDecrypt(profile.bankCountry) ?? "",
                payoutCurrency: profile.payoutCurrency,
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
