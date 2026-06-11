import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/adminAuth";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import type {
  DailyRevenue,
  StatusCount,
  ProductCount,
  TrafficSource,
  PaymentMethod,
} from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireAdminRole("ADMIN");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenueOrders, allStatusGroups, allPaidOrders, affiliateCount, directCount, paymentGroups] =
    await Promise.all([
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

  // ── Daily revenue
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

  // ── Status counts
  const statusCounts: StatusCount[] = allStatusGroups.map((s) => ({
    status: s.status,
    count: s._count.id,
  }));

  // ── Top products
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

  // ── Traffic sources
  const trafficSources: TrafficSource[] = [
    { name: "Affiliate", value: affiliateCount },
    { name: "Direct", value: directCount },
  ].filter((s) => s.value > 0);

  // ── Payment methods
  const paymentMethods: PaymentMethod[] = paymentGroups.map((g) => ({
    name: g.paymentMethod,
    value: g._count.id,
  }));

  // ── KPI totals
  const totalRevenueAed = Math.round(
    revenueOrders.reduce((sum, o) => sum + Number(o.subtotalAed), 0)
  );
  const totalOrders = allStatusGroups.reduce((sum, s) => sum + s._count.id, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Insights</p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
        Analytics
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Revenue chart shows the last 30 days. All other metrics are all-time.
      </p>

      <div className="mt-10">
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
  );
}
