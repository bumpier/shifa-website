import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { formatPrice } from "@/config/brand";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [pendingOrders, paidOrders, shippedOrders, productCount, affiliateCount, pendingCommissions, openPayouts, paidAgg] =
    await Promise.all([
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { status: "paid" } }),
      prisma.order.count({ where: { status: "shipped" } }),
      prisma.product.count({ where: { active: true } }),
      prisma.affiliateProfile.count(),
      prisma.affiliateReferral.count({ where: { status: "pending" } }),
      prisma.payoutRequest.count({ where: { status: { in: ["requested", "processing"] } } }),
      prisma.order.aggregate({
        where: { status: { in: ["paid", "shipped", "delivered"] } },
        _sum: { subtotalAed: true },
      }),
    ]);

  const revenueAed = paidAgg._sum.subtotalAed ?? new Prisma.Decimal(0);

  const cards = [
    { label: "Awaiting fulfilment", value: String(paidOrders), href: "/admin/orders?status=paid", highlight: paidOrders > 0 },
    { label: "Shipped", value: String(shippedOrders), href: "/admin/orders?status=shipped" },
    { label: "Pending payment", value: String(pendingOrders), href: "/admin/orders?status=pending" },
    { label: "Revenue (AED, items)", value: formatPrice(revenueAed.toString(), "AED"), href: "/admin/orders" },
    { label: "Active products", value: String(productCount), href: "/admin/products" },
    { label: "Affiliates", value: String(affiliateCount), href: "/admin/affiliates" },
    { label: "Commissions to review", value: String(pendingCommissions), href: "/admin/affiliates", highlight: pendingCommissions > 0 },
    { label: "Open payout requests", value: String(openPayouts), href: "/admin/affiliates", highlight: openPayouts > 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Store overview</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Dashboard
      </h1>

      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`card p-5 transition-shadow hover:shadow-lift ${
              c.highlight ? "border-brand bg-brand-tint" : ""
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {c.label}
            </p>
            <p className="mt-2 font-display text-3xl font-medium text-brand-deep">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/admin/products/new" className="btn-primary">
          Add product
        </Link>
        <Link href="/admin/affiliates/invite" className="btn-secondary">
          Invite affiliate
        </Link>
      </div>
    </div>
  );
}
