import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, getAdminSession } from "@/lib/adminAuth";
import { formatPrice } from "@/config/brand";
import { Prisma } from "@prisma/client";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import type {
  DailyRevenue,
  StatusCount,
  ProductCount,
  TrafficSource,
  PaymentMethod,
} from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const session = await getAdminSession();
  if (session?.role === "PACKER") redirect("/admin/orders");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingOrders,
    paidOrders,
    shippedOrders,
    productCount,
    affiliateCount,
    pendingCommissions,
    openPayouts,
    revenueOrders,
    allStatusGroups,
    allPaidOrders,
    affiliateOrderCount,
    directOrderCount,
    paymentGroups,
  ] = await Promise.all([
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: "paid" } }),
    prisma.order.count({ where: { status: "shipped" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.affiliateProfile.count(),
    prisma.affiliateReferral.count({ where: { status: "pending" } }),
    prisma.payoutRequest.count({ where: { status: { in: ["requested", "processing"] } } }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { in: ["paid", "packed", "shipped", "delivered"] },
      },
      select: { createdAt: true, subtotalAed: true },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.order.findMany({
      where: { status: { in: ["paid", "packed", "shipped", "delivered"] } },
      select: { items: true },
    }),
    prisma.order.count({ where: { refCode: { not: null } } }),
    prisma.order.count({ where: { refCode: null } }),
    prisma.order.groupBy({ by: ["paymentMethod"], _count: { id: true } }),
  ]);

  // ── Quick-action cards
  const totalRevenueAed = Math.round(
    revenueOrders.reduce((sum, o) => sum + Number(o.subtotalAed), 0)
  );

  const allOrdersAgg = await prisma.order.aggregate({
    where: { status: { in: ["paid", "packed", "shipped", "delivered"] } },
    _sum: { subtotalAed: true },
  });
  const revenueDecimal = allOrdersAgg._sum.subtotalAed ?? new Prisma.Decimal(0);

  const cards = [
    { label: "Awaiting fulfilment", value: String(paidOrders), href: "/admin/orders?status=paid", highlight: paidOrders > 0 },
    { label: "Shipped", value: String(shippedOrders), href: "/admin/orders?status=shipped" },
    { label: "Pending payment", value: String(pendingOrders), href: "/admin/orders?status=pending" },
    { label: "Revenue (AED)", value: formatPrice(revenueDecimal.toString(), "AED"), href: "/admin/orders" },
    { label: "Active products", value: String(productCount), href: "/admin/products" },
    { label: "Affiliates", value: String(affiliateCount), href: "/admin/affiliates" },
    { label: "Commissions to review", value: String(pendingCommissions), href: "/admin/affiliates", highlight: pendingCommissions > 0 },
    { label: "Open payout requests", value: String(openPayouts), href: "/admin/affiliates", highlight: openPayouts > 0 },
  ];

  // ── Analytics data
  const revenueByDate: Record<string, number> = {};
  for (const o of revenueOrders) {
    const key = o.createdAt.toISOString().split("T")[0]!;
    revenueByDate[key] = (revenueByDate[key] ?? 0) + Number(o.subtotalAed);
  }
  const dailyRevenue: DailyRevenue[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0]!;
    const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    dailyRevenue.push({ date: label, revenue: Math.round(revenueByDate[key] ?? 0) });
  }

  const statusCounts: StatusCount[] = allStatusGroups.map((s) => ({
    status: s.status,
    count: s._count.id,
  }));

  const productCounts: Record<string, number> = {};
  for (const o of allPaidOrders) {
    try {
      const items = JSON.parse(o.items) as Array<{ name: string; qty: number }>;
      for (const item of items) {
        productCounts[item.name] = (productCounts[item.name] ?? 0) + (item.qty ?? 1);
      }
    } catch {
      // malformed items JSON — skip
    }
  }
  const topProducts: ProductCount[] = Object.entries(productCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const trafficSources: TrafficSource[] = [
    { name: "Affiliate", value: affiliateOrderCount },
    { name: "Direct", value: directOrderCount },
  ].filter((s) => s.value > 0);

  const paymentMethods: PaymentMethod[] = paymentGroups.map((g) => ({
    name: g.paymentMethod,
    value: g._count.id,
  }));

  const totalOrders = allStatusGroups.reduce((sum, s) => sum + s._count.id, 0);

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

      <div className="mt-14">
        <h2 className="font-display text-xl font-medium text-brand-deep">Analytics</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Revenue chart shows the last 30 days. All other metrics are all-time.
        </p>
        <div className="mt-6">
          <AnalyticsDashboard
            dailyRevenue={dailyRevenue}
            statusCounts={statusCounts}
            topProducts={topProducts}
            trafficSources={trafficSources}
            paymentMethods={paymentMethods}
            totalRevenueAed={totalRevenueAed}
            totalOrders={totalOrders}
          />
        </div>
      </div>
    </div>
  );
}
