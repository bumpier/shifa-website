import Link from "next/link";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";
import { ProductCard } from "@/components/ProductCard";
import { priceMap } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const TRUST_ITEMS = [
  {
    title: "Secure checkout",
    body: brand.trust.secureLine,
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-2.5 9.5l2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Tracked delivery",
    body: brand.trust.shippingLine,
    icon: (
      <path d="M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5ZM7 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Quality guaranteed",
    body: brand.trust.qualityLine,
    icon: (
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    take: 6,
  });

  return (
    <>
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <p className="eyebrow">{brand.name} wellness</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-medium leading-[1.1] tracking-tight text-brand-deep sm:text-6xl">
            {brand.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            A small, carefully chosen range of wellness essentials — shipped
            with care, paid for the way that suits you: card, JazzCash or
            Easypaisa.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary">
              Shop the range
            </Link>
            <Link href="/products" className="btn-secondary">
              Best sellers
            </Link>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-line bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  {item.icon}
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="eyebrow">The range</p>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
              Featured products
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden text-sm font-semibold text-brand hover:text-brand-deep sm:block"
          >
            View all →
          </Link>
        </div>

        {products.length === 0 ? (
          <p className="text-ink-soft">Products coming soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={{ id: p.id, slug: p.slug, name: p.name, description: p.description, images: p.images, stock: p.stock, prices: priceMap(p) }} />
            ))}
          </div>
        )}
      </section>

      {/* Quiet reassurance strip */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="card flex flex-col items-start gap-6 bg-brand p-10 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Questions before you order?
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
              We are a small team and reply personally. Email us any time at{" "}
              <a href={`mailto:${brand.contact.email}`} className="underline underline-offset-2">
                {brand.contact.email}
              </a>
              .
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-deep"
          >
            Browse products
          </Link>
        </div>
      </section>
    </>
  );
}
