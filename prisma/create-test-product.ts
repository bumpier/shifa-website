import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Idempotent: upsert by slug so it's safe to run repeatedly and on any environment.
// A $1 product for exercising the checkout / crypto payment flow end to end.
async function main() {
  const product = await prisma.product.upsert({
    where: { slug: "test-product" },
    update: {
      priceUsd: 1, priceGbp: 1, priceEur: 1, priceAed: 4, pricePkr: 280,
      stock: 99, active: true,
    },
    create: {
      slug: "test-product",
      name: "Test Product — $1",
      description:
        "Internal test product for verifying the checkout and payment flow. Priced at $1. Safe to deactivate or delete.",
      priceUsd: 1, priceGbp: 1, priceEur: 1, priceAed: 4, pricePkr: 280,
      stock: 99,
      weightGrams: 1,
      images: "[]",
      active: true,
    },
  });
  console.log(`Test product ready: ${product.slug} (id=${product.id}) → /products/${product.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
