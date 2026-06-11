import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";
import { parseImages, priceMap } from "@/lib/catalog";
import { CERTIFICATIONS } from "@/config/certifications";
import { AddToCart } from "@/components/AddToCart";
import { ProductImage } from "@/components/ProductImage";
import { ClientPrice } from "@/components/ClientPrice";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.active) notFound();

  const images = parseImages(product);
  const prices = priceMap(product);
  const certs = CERTIFICATIONS[product.slug] ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      {/* Hero: image + buy */}
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-brand-tint">
          <div className="relative aspect-square">
            <ProductImage
              src={images[0] ?? null}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            <span className="absolute top-2 right-2 rounded-full bg-brand px-2 py-1 text-xs font-medium text-white">
              For research purposes only
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <p className="eyebrow">{brand.name}</p>
          <h1 className="mt-2 font-display text-3xl font-medium leading-snug tracking-tight text-brand-deep sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-2xl font-semibold text-brand">
            <ClientPrice prices={prices} />
          </p>

          <div className="mt-8">
            <AddToCart
              productId={product.id}
              slug={product.slug}
              name={product.name}
              image={images[0] ?? null}
              prices={prices}
              inStock={product.stock > 0}
            />
          </div>

          <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-ink-soft">
            <li>✓ {brand.trust.secureLine}</li>
            <li>✓ {brand.trust.shippingLine}</li>
            <li>✓ {brand.trust.qualityLine}</li>
          </ul>
        </div>
      </div>

      {/* Description + Certifications */}
      <div className="mt-16 border-t border-line pt-12 lg:grid lg:grid-cols-[1fr_260px] lg:gap-12">
        {/* Description */}
        <div>
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="mt-10 first:mt-0 mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand">
                  {children}
                </h2>
              ),
              p: ({ children, node }) => {
                const firstChild = node?.children?.[0] as { type: string; tagName?: string } | undefined;
                const isTimeline = firstChild?.type === "element" && firstChild?.tagName === "strong";

                if (isTimeline) {
                  return (
                    <div className="relative mb-0 pl-7 pb-7 last:pb-0 border-l-2 border-brand/20">
                      <span className="absolute -left-[7px] top-0.5 h-3 w-3 rounded-full bg-brand ring-4 ring-paper" />
                      <div className="text-sm leading-relaxed text-ink-soft">{children}</div>
                    </div>
                  );
                }

                return (
                  <p className="mb-4 text-base leading-relaxed text-ink-soft">
                    {children}
                  </p>
                );
              },
              ul: ({ children }) => (
                <ul className="mb-4 grid gap-2 sm:grid-cols-2">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-brand-tint flex items-center justify-center text-[10px] font-bold text-brand">✓</span>
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => (
                <strong className="inline-block mb-1.5 rounded-md bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-deep">
                  {children}
                </strong>
              ),
            }}
          >
            {product.description}
          </ReactMarkdown>
        </div>

        {/* Certifications sidebar */}
        {certs.length > 0 && (
          <div className="mt-10 lg:mt-0">
            <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand">
              Certificates of Analysis
            </h2>
            <div className="flex flex-col gap-2">
              {certs.map((cert) => (
                <a
                  key={cert.batch}
                  href={cert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm transition-colors hover:border-brand/40 hover:bg-brand-tint"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand group-hover:bg-white">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 2C3 1.44772 3.44772 1 4 1H9L13 5V14C13 14.5523 12.5523 15 12 15H4C3.44772 15 3 14.5523 3 14V2Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                      <path d="M9 1V5H13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                      <path d="M5.5 10H10.5M5.5 12H8.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink">{cert.compound}</p>
                    <p className="text-xs text-ink-soft">NovaCert · Batch {cert.batch}</p>
                  </div>
                  <svg className="h-3.5 w-3.5 shrink-0 text-ink-soft/50 group-hover:text-brand" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 7H11.5M7.5 3L11.5 7L7.5 11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
