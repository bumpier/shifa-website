import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { tryDecrypt } from "@/lib/encrypt";
import { formatPrice, type Currency } from "@/config/brand";
import {
  processPayoutAction,
  reviewReferralAction,
  setAffiliateStatusAction,
  setCommissionRateAction,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const profile = await prisma.affiliateProfile.findUnique({
    where: { id },
    include: {
      user: true,
      referrals: { orderBy: { createdAt: "desc" }, take: 50 },
      payoutRequests: { orderBy: { requestedAt: "desc" }, take: 20 },
    },
  });
  if (!profile) notFound();

  const bank = {
    bankName: tryDecrypt(profile.bankName),
    accountName: tryDecrypt(profile.bankAccountName),
    accountNumber: tryDecrypt(profile.bankAccountNumber),
    iban: tryDecrypt(profile.bankIBAN),
    country: tryDecrypt(profile.bankCountry),
  };

  const stats = [
    { label: "Total earned", value: formatPrice(profile.totalEarned.toString(), "AED") },
    { label: "Pending balance", value: formatPrice(profile.pendingBalance.toString(), "AED") },
    { label: "Paid out", value: formatPrice(profile.totalPaid.toString(), "AED") },
    { label: "Referrals", value: String(profile.referrals.length) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Affiliate detail</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
            {profile.user.name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {profile.user.email} · code{" "}
            <span className="font-mono text-xs">{profile.referralCode}</span> ·{" "}
            {profile.user.emailVerifiedAt ? "email verified" : "email NOT verified"}
          </p>
        </div>
        <form action={setAffiliateStatusAction}>
          <input type="hidden" name="userId" value={profile.user.id} />
          <input
            type="hidden"
            name="status"
            value={profile.user.status === "active" ? "suspended" : "active"}
          />
          <button
            type="submit"
            className={profile.user.status === "active"
              ? "rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              : "btn-primary"}
          >
            {profile.user.status === "active" ? "Suspend account" : "Reactivate account"}
          </button>
        </form>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-medium text-brand-deep">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Commission rate */}
        <div className="card p-6">
          <p className="eyebrow mb-4">Commission rate</p>
          <form action={setCommissionRateAction} className="flex items-end gap-3">
            <input type="hidden" name="affiliateId" value={profile.id} />
            <div className="flex-1">
              <label className="label" htmlFor="rate">Rate (%)</label>
              <input
                id="rate"
                name="rate"
                type="number"
                step="0.5"
                min="0"
                max="100"
                defaultValue={profile.commissionRate.toString()}
                className="field"
              />
            </div>
            <button type="submit" className="btn-secondary">Update</button>
          </form>
        </div>

        {/* Bank details */}
        <div className="card p-6">
          <p className="eyebrow mb-4">Bank details (decrypted for payout)</p>
          {bank.accountNumber ? (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Bank</dt>
                <dd className="font-medium">{bank.bankName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Account name</dt>
                <dd className="font-medium">{bank.accountName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Account number</dt>
                <dd className="font-mono text-xs">{bank.accountNumber}</dd>
              </div>
              {bank.iban && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">IBAN</dt>
                  <dd className="font-mono text-xs">{bank.iban}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Country</dt>
                <dd className="font-medium">{bank.country}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">Not provided yet.</p>
          )}
        </div>
      </div>

      {/* Referral history */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-medium text-brand-deep">Referral history</h2>
        {profile.referrals.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-ink-soft">No referrals yet.</p>
        ) : (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Order total</th>
                  <th className="px-5 py-3 font-semibold">Commission (AED)</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {profile.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 text-ink-soft">
                      {r.createdAt.toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{r.orderId.slice(0, 8)}…</td>
                    <td className="px-5 py-3">
                      {formatPrice(r.orderTotal.toString(), r.currency as Currency)}
                    </td>
                    <td className="px-5 py-3 font-medium">
                      {formatPrice(r.commissionAmountAed.toString(), "AED")}
                    </td>
                    <td className="px-5 py-3 capitalize">{r.status}</td>
                    <td className="px-5 py-3">
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <form action={reviewReferralAction}>
                            <input type="hidden" name="referralId" value={r.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <button
                              type="submit"
                              className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-deep"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={reviewReferralAction}>
                            <input type="hidden" name="referralId" value={r.id} />
                            <input type="hidden" name="decision" value="reject" />
                            <button
                              type="submit"
                              className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payout requests */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-medium text-brand-deep">Payout requests</h2>
        {profile.payoutRequests.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-ink-soft">No payout requests.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {profile.payoutRequests.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {formatPrice(p.amount.toString(), "AED")}{" "}
                      <span className="ml-2 rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold capitalize text-brand-deep">
                        {p.status}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      Requested {p.requestedAt.toLocaleString("en-GB")}
                      {p.processedAt && ` · processed ${p.processedAt.toLocaleString("en-GB")}`}
                      {p.adminNote && ` · note: ${p.adminNote}`}
                    </p>
                  </div>
                  {(p.status === "requested" || p.status === "processing") && (
                    <form action={processPayoutAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="payoutId" value={p.id} />
                      <input
                        name="adminNote"
                        maxLength={500}
                        placeholder="Note (optional)"
                        className="field !w-44 !py-2 text-xs"
                      />
                      <button
                        type="submit"
                        name="decision"
                        value="paid"
                        className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-deep"
                      >
                        Mark paid
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="rejected"
                        className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
