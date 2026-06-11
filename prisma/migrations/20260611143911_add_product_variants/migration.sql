-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_aed" DECIMAL NOT NULL,
    "price_pkr" DECIMAL NOT NULL,
    "price_usd" DECIMAL NOT NULL,
    "price_gbp" DECIMAL NOT NULL,
    "price_eur" DECIMAL NOT NULL DEFAULT 0,
    "images" TEXT NOT NULL DEFAULT '[]',
    "variants" TEXT NOT NULL DEFAULT '[]',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Product" ("active", "createdAt", "description", "id", "images", "name", "price_aed", "price_eur", "price_gbp", "price_pkr", "price_usd", "slug", "stock", "weightGrams") SELECT "active", "createdAt", "description", "id", "images", "name", "price_aed", "price_eur", "price_gbp", "price_pkr", "price_usd", "slug", "stock", "weightGrams" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
