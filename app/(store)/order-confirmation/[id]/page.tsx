import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { brand, formatPrice, type Currency } from "@/config/brand";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Order IDs are UUIDs — unguessable, so showing the summary here is safe
  if (!z.string().uuid().safeParse(id).success) notFound();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) notFound();

  const items = JSON.parse(order.items) as {
    name: string;
    qty: number;
    unitPrice: string;
  }[];
  const currency = order.currency as Currency;
  const paid = order.status !== "pending" && order.status !== "cancelled";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="card overflow-hidden">
        <div className="bg-brand px-8 py-10 text-center text-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            {paid ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <h1 className="mt-5 font-display text-3xl font-medium tracking-tight">
            {paid ? "Thank you for your order" : "Order received"}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            {paid
              ? "Payment confirmed. We are preparing your shipment."
              : "We're waiting for your payment to be confirmed. This page will reflect the latest status when refreshed."}
          </p>
        </div>

        <div className="p-8">
          <div className="flex flex-wrap justify-between gap-2 text-sm text-ink-soft">
            <span>
              Order <span className="font-mono text-xs">{order.id}</span>
            </span>
            <span>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(order.createdAt)}</span>
          </div>

          <ul className="mt-6 divide-y divide-line text-sm">
            {items.map((item, idx) => (
              <li key={idx} className="flex justify-between py-3">
                <span>
                  {item.name} <span className="text-ink-soft">× {item.qty}</span>
                </span>
                <span className="font-medium">
                  {formatPrice(parseFloat(item.unitPrice) * item.qty, currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between border-t border-line pt-4">
            <span className="font-semibold">Total</span>
            <span className="font-semibold text-brand-deep">
              {formatPrice(order.totalAmount.toString(), currency)}
            </span>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-ink-soft">
            A confirmation has been recorded for{" "}
            <span className="font-medium text-ink">{order.customerEmail}</span>. If you have
            any questions, contact us at{" "}
            <a href={`mailto:${brand.contact.email}`} className="text-brand underline underline-offset-2">
              {brand.contact.email}
            </a>
            .
          </p>

          <div className="mt-8 text-center">
            <Link href="/products" className="btn-secondary">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
