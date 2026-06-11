import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CheckoutSchema, verifyOrigin } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { createPayment } from "@/lib/paykassma";
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

    // Wallets settle in PKR only
    if (input.paymentMethod !== "card" && input.currency !== "PKR") {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }

    // Server-side pricing — never trust client amounts
    const ids = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    if (products.length !== new Set(ids).size) {
      return NextResponse.json({ error: "Invalid order details" }, { status: 400 });
    }

    let total = new Prisma.Decimal(0);
    let subtotalAed = new Prisma.Decimal(0);
    const orderItems = input.items.map((line) => {
      const product = products.find((p) => p.id === line.productId)!;
      if (product.stock < line.qty) {
        throw Object.assign(new Error("stock"), { code: "OUT_OF_STOCK", name: product.name });
      }

      let unitPriceStr: string;
      let unitPriceAedStr: string;
      if (line.variantLabel) {
        const vPrice = priceForVariant(product, line.variantLabel, input.currency);
        const vPriceAed = priceForVariant(product, line.variantLabel, "AED");
        if (!vPrice || !vPriceAed) {
          throw Object.assign(new Error("variant"), { code: "INVALID_VARIANT" });
        }
        unitPriceStr = vPrice;
        unitPriceAedStr = vPriceAed;
      } else {
        unitPriceStr = priceFor(product, input.currency);
        unitPriceAedStr = product.priceAed.toFixed(2);
      }

      const unitPrice = new Prisma.Decimal(unitPriceStr);
      const unitPriceAed = new Prisma.Decimal(unitPriceAedStr);
      total = total.add(unitPrice.mul(line.qty));
      subtotalAed = subtotalAed.add(unitPriceAed.mul(line.qty));
      const itemName = line.variantLabel ? `${product.name} (${line.variantLabel})` : product.name;
      return {
        productId: product.id,
        slug: product.slug,
        name: itemName,
        qty: line.qty,
        unitPrice: unitPrice.toFixed(2),
        unitPriceAed: unitPriceAed.toFixed(2),
      };
    });

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
        subtotalAed,
        paymentMethod: input.paymentMethod,
        refCode: refCode && /^[a-z0-9]{4,16}$/.test(refCode) ? refCode : null,
      },
    });

    const payment = await createPayment({
      orderId: order.id,
      amount: total.toFixed(2),
      currency: input.currency,
      method: input.paymentMethod,
      customerName: input.name,
      customerEmail: input.email,
      customerPhone: input.phone,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paykassmaRef: payment.paymentRef },
    });

    return NextResponse.json({ paymentUrl: payment.paymentUrl, orderId: order.id });
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
