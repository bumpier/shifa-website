import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { slug: true, updatedAt: true },
  });

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `https://shifapk.com/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: "https://shifapk.com",
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: "https://shifapk.com/products",
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: "https://shifapk.com/privacy",
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...productEntries,
  ];
}
