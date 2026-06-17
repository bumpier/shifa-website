import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { canonicalOrigin } from "@/lib/site-url";

// Generated per request (not at build) so `next build` never depends on the DB.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = canonicalOrigin();
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true, createdAt: true },
  });

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: p.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    { url: base, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    ...productEntries,
  ];
}
