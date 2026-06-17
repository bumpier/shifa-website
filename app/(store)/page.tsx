import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";
import { ProductCard } from "@/components/ProductCard";
import { priceMap } from "@/lib/catalog";

export const metadata: Metadata = {
  title: `${brand.name} | NovaCert-Certified Peptides | UAE & Pakistan`,
  description:
    "Research-grade peptides for body composition, recovery, skin, and longevity. NovaCert-certified purity at ≥99.9%. Tracked shipping to UAE, Pakistan, and worldwide. Pay with crypto (BTC, ETH, USDT, XMR) and get 10% off.",
  openGraph: {
    title: `${brand.name} | NovaCert-Certified Peptides | UAE & Pakistan`,
    description:
      "Research-grade peptides for body composition, recovery, skin, and longevity. NovaCert-certified purity at ≥99.9%. Tracked shipping to UAE, Pakistan, and worldwide.",
  },
};

const homepageFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Where does Shifa Asia ship to?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Shifa Asia ships everywhere. We focus on UAE and Pakistan, but every order ships tracked, regardless of where you are. We pack and ship every order ourselves.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods does Shifa Asia accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Shifa Asia accepts cryptocurrency payments — Bitcoin, Ethereum, USDT, and Monero — processed securely through Heleket, with a 10% discount on every crypto order.",
      },
    },
    {
      "@type": "Question",
      name: "Are Shifa Asia products high quality?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every Shifa Asia product carries a NovaCert Certificate of Analysis with the batch number, compound name, and purity result verified at ≥99.9%. You can view the certificate before you buy. It is on every product page.",
      },
    },
    {
      "@type": "Question",
      name: "How can I contact Shifa Asia?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can reach Shifa Asia by email at hello@shifa.com. We are a small team and reply personally to every enquiry.",
      },
    },
  ],
};

export const dynamic = "force-dynamic";

const TRUST_ITEMS = [
  {
    title: "Certified purity",
    body: brand.trust.qualityLine,
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-2.5 9.5l2 2 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Tracked worldwide",
    body: brand.trust.shippingLine,
    icon: (
      <path d="M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5ZM7 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: "Secure checkout",
    body: brand.trust.secureLine,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageFaqSchema) }}
      />
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
          <p className="eyebrow">NovaCert-certified · ≥99.9% purity</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-medium leading-[1.1] tracking-tight text-brand-deep sm:text-6xl">
            Research-grade peptides for body composition, recovery &amp; longevity.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            Retatrutide, NAD+, BPC-157, GHK-Cu, and more. Every batch
            third-party verified by NovaCert.{" "}
            <a href="/products#certificates" className="underline underline-offset-2 hover:text-brand">
              View certificates before you buy.
            </a>{" "}
            Tracked delivery to UAE, Pakistan, and worldwide.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary">
              Shop certified peptides
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
              Protocols for every goal
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden text-sm font-semibold text-brand hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded sm:block"
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

      {/* Affiliate programme */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-line bg-white px-8 py-12 sm:px-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-lg">
              <p className="eyebrow">Affiliate programme</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
                Earn 10% on every order you refer
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Share your unique link. When someone orders through it, you earn 10% of the sale, paid out monthly with no minimums. Trusted by fitness coaches, wellness practitioners, and researchers across the UAE and Pakistan.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-ink-soft">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l2.5 2.5L10 3.5" />
                    </svg>
                  </span>
                  10% commission on every order, one of the highest rates in the industry
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l2.5 2.5L10 3.5" />
                    </svg>
                  </span>
                  Real-time dashboard to track clicks, orders, and earnings
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l2.5 2.5L10 3.5" />
                    </svg>
                  </span>
                  Free to join, no approval wait and no minimum payout
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 sm:shrink-0">
              <Link href="/auth/register?type=affiliate" className="btn-primary text-center">
                Join the programme
              </Link>
              <a
                href={`mailto:${brand.contact.email}?subject=Affiliate%20programme`}
                className="btn-secondary text-center text-sm"
              >
                Questions? Email us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet reassurance strip */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="card flex flex-col items-start gap-6 bg-brand p-10 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Not sure which protocol is right for you?
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
              We&rsquo;re a small team, not a warehouse. Email us before you
              order and we&rsquo;ll help you find the right fit.
            </p>
          </div>
          <a
            href={`mailto:${brand.contact.email}?subject=Protocol%20advice`}
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-deep shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            Ask before you buy
          </a>
        </div>
      </section>
    </>
  );
}
