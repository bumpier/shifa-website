import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentAffiliate } from "@/lib/auth";
import { tryDecrypt } from "@/lib/encrypt";
import { formatPrice } from "@/config/brand";
import { logoutAction, resendVerificationAction } from "@/app/(store)/auth/actions";
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

  // Email verification is required before the dashboard unlocks
  if (!user.emailVerifiedAt) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <div className="card p-8">
          <p className="eyebrow">One more step</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
            Verify your email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            We sent a verification link to <span className="font-medium text-ink">{user.email}</span>.
            Your dashboard unlocks as soon as it is confirmed.
          </p>
          <form action={resendVerificationAction} className="mt-8">
            <button type="submit" className="btn-primary w-full">
              Resend verification email
            </button>
          </form>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="text-sm text-ink-soft hover:text-brand">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const [referrals, payouts] = await Promise.all([
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
  ]);

  const referralLink = `${process.env.NEXT_PUBLIC_SITE_URL}/?ref=${profile.referralCode}`;
  const minPayout = parseFloat(process.env.AFFILIATE_MIN_PAYOUT_AED ?? "100");
  const pending = parseFloat(profile.pendingBalance.toString());
  const hasBank = !!profile.bankAccountNumber;

  const stats = [
    { label: "Total referrals", value: String(referrals.length) },
    { label: "Total earned", value: formatPrice(profile.totalEarned.toString(), "AED") },
    { label: "Pending balance", value: formatPrice(profile.pendingBalance.toString(), "AED") },
    { label: "Paid out", value: formatPrice(profile.totalPaid.toString(), "AED") },
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
            link, credited in AED.
          </p>
        </div>
        <CopyButton text={referralLink} />
      </div>

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
                No referrals yet — share your link to get started.
              </p>
            ) : (
              <div className="card mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Order value</th>
                      <th className="px-5 py-3 font-semibold">Commission</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {referrals.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3 text-ink-soft">
                          {r.createdAt.toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-5 py-3">
                          {formatPrice(r.orderTotal.toString(), r.currency as never)}
                        </td>
                        <td className="px-5 py-3 font-medium">
                          {formatPrice(r.commissionAmountAed.toString(), "AED")}
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
                          {p.requestedAt.toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-5 py-3 font-medium">
                          {formatPrice(p.amount.toString(), "AED")}
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
                {formatPrice(profile.pendingBalance.toString(), "AED")}
              </span>
              . Minimum payout is {formatPrice(minPayout, "AED")}.
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
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
