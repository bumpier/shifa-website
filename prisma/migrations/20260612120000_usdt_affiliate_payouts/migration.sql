-- Affiliate tracking switches its unit of account from AED to USDT and
-- payouts move from bank transfer to manual USDT (TRC20) transfers.
-- Pre-launch reset: existing referral/payout test data is wiped and
-- profile balances zeroed.
DELETE FROM "AffiliateReferral";
DELETE FROM "PayoutRequest";
UPDATE "AffiliateProfile" SET "totalEarned" = 0, "totalPaid" = 0, "pendingBalance" = 0;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "subtotalUsd" DECIMAL NOT NULL DEFAULT 0,
    "paykassmaRef" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "refCode" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("id", "status", "customerName", "customerEmail", "customerPhone", "shippingAddress", "items", "currency", "totalAmount", "paykassmaRef", "paymentMethod", "refCode", "notes", "createdAt", "updatedAt") SELECT "id", "status", "customerName", "customerEmail", "customerPhone", "shippingAddress", "items", "currency", "totalAmount", "paykassmaRef", "paymentMethod", "refCode", "notes", "createdAt", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

CREATE TABLE "new_AffiliateProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "commissionRate" DECIMAL NOT NULL DEFAULT 10.0,
    "usdtAddress" TEXT,
    "totalEarned" DECIMAL NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL NOT NULL DEFAULT 0,
    "recruiterId" TEXT,
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "masterAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateProfile_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "AffiliateProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateProfile" ("id", "userId", "referralCode", "commissionRate", "totalEarned", "totalPaid", "pendingBalance", "recruiterId", "isMaster", "masterAt", "createdAt", "updatedAt") SELECT "id", "userId", "referralCode", "commissionRate", "totalEarned", "totalPaid", "pendingBalance", "recruiterId", "isMaster", "masterAt", "createdAt", "updatedAt" FROM "AffiliateProfile";
DROP TABLE "AffiliateProfile";
ALTER TABLE "new_AffiliateProfile" RENAME TO "AffiliateProfile";
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");

CREATE TABLE "new_AffiliateReferral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderTotal" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "commissionRate" DECIMAL NOT NULL,
    "commissionAmountUsdt" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "kind" TEXT NOT NULL DEFAULT 'direct',
    "parentReferralId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateReferral_parentReferralId_fkey" FOREIGN KEY ("parentReferralId") REFERENCES "AffiliateReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
DROP TABLE "AffiliateReferral";
ALTER TABLE "new_AffiliateReferral" RENAME TO "AffiliateReferral";
CREATE UNIQUE INDEX "AffiliateReferral_parentReferralId_key" ON "AffiliateReferral"("parentReferralId");
CREATE UNIQUE INDEX "AffiliateReferral_orderId_kind_key" ON "AffiliateReferral"("orderId", "kind");

CREATE TABLE "new_PayoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "walletSnapshot" TEXT NOT NULL,
    "txHash" TEXT,
    "adminNote" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "PayoutRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DROP TABLE "PayoutRequest";
ALTER TABLE "new_PayoutRequest" RENAME TO "PayoutRequest";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
