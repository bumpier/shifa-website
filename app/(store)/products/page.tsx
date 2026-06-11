import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { priceMap } from "@/lib/catalog";

export const metadata: Metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="eyebrow">The full range</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-brand-deep">
        Shop
      </h1>
      <p className="mt-3 max-w-lg text-ink-soft">
        Every product is stocked, packed and shipped by us directly.
      </p>

      {products.length === 0 ? (
        <p className="mt-12 text-ink-soft">Products coming soon.</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={{ id: p.id, slug: p.slug, name: p.name, description: p.description, images: p.images, stock: p.stock, prices: priceMap(p) }} />
          ))}
        </div>
      )}
    </div>
  );
}
