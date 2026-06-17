import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CheckoutSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { originFromHeaders } from "@/lib/site-url";
import { createCryptoPayment, type CryptoPaymentMethod } from "@/lib/heleket";
import { priceFor, priceForVariant } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!verifyOrigin(req)) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 403 });
    }
    if (!rateLimit(`checkout:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const parsed = CheckoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    const input = parsed.data;

    // Server-side pricing — never trust client amounts
    const ids = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    if (products.length !== new Set(ids).size) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }

    let total = new Prisma.Decimal(0);
    let subtotalUsd = new Prisma.Decimal(0);
    const orderItems = input.items.map((line) => {
      const product = products.find((p) => p.id === line.productId)!;
      if (product.stock < line.qty) {
        throw Object.assign(new Error("stock"), { code: "OUT_OF_STOCK", name: product.name });
      }

      let unitPriceStr: string;
      let unitPriceUsdStr: string;
      if (line.variantLabel) {
        const vPrice = priceForVariant(product, line.variantLabel, input.currency);
        const vPriceUsd = priceForVariant(product, line.variantLabel, "USD");
        if (!vPrice || !vPriceUsd) {
          throw Object.assign(new Error("variant"), { code: "INVALID_VARIANT" });
        }
        unitPriceStr = vPrice;
        unitPriceUsdStr = vPriceUsd;
      } else {
        unitPriceStr = priceFor(product, input.currency);
        unitPriceUsdStr = priceFor(product, "USD");
      }

      const unitPrice = new Prisma.Decimal(unitPriceStr);
      const unitPriceUsd = new Prisma.Decimal(unitPriceUsdStr);
      total = total.add(unitPrice.mul(line.qty));
      subtotalUsd = subtotalUsd.add(unitPriceUsd.mul(line.qty));
      const itemName = line.variantLabel ? `${product.name} (${line.variantLabel})` : product.name;
      return {
        productId: product.id,
        slug: product.slug,
        name: itemName,
        qty: line.qty,
        unitPrice: unitPrice.toFixed(2),
        unitPriceUsd: unitPriceUsd.toFixed(2),
      };
    });

    // All payments are crypto — apply the 10% crypto discount
    const discount = total.mul(0.1); // 10% off
    total = total.sub(discount);
    subtotalUsd = subtotalUsd.mul(0.9); // also apply to USD basis

    const refCode = (await cookies()).get("ref_code")?.value ?? null;

    const order = await prisma.order.create({
      data: {
        status: "pending",
        customerName: input.name,
        customerEmail: input.email,
        customerPhone: input.phone,
        shippingAddress: JSON.stringify({
          line1: input.addressLine1,
          line2: input.addressLine2 || null,
          city: input.city,
          country: input.country,
          postalCode: input.postalCode || null,
        }),
        items: JSON.stringify(orderItems),
        currency: input.currency,
        totalAmount: total,
        subtotalUsd,
        paymentMethod: input.paymentMethod,
        refCode: refCode && /^[a-z0-9]{4,16}$/.test(refCode) ? refCode : null,
      },
    });

    const cryptoPayment = await createCryptoPayment({
      orderId: order.id,
      amount: subtotalUsd.toFixed(2), // USD total, 10% crypto discount already applied
      method: input.paymentMethod as CryptoPaymentMethod,
      customerName: input.name,
      customerEmail: input.email,
      origin: originFromHeaders(req.headers),
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentRef: cryptoPayment.paymentRef,
        notes: `Crypto payment (${input.paymentMethod.toUpperCase()}) - 10% discount applied`,
      },
    });

    return NextResponse.json({ paymentUrl: cryptoPayment.paymentUrl, orderId: order.id });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "OUT_OF_STOCK") {
      return NextResponse.json(
        { error: "One of the items in your cart is out of stock" },
        { status: 409 }
      );
    }
    if (code === "INVALID_VARIANT") {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }
    console.error("[internal] checkout failed", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
