-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AffiliateProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "commissionRate" DECIMAL NOT NULL DEFAULT 10.0,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIBAN" TEXT,
    "bankCountry" TEXT,
    "payoutCurrency" TEXT NOT NULL DEFAULT 'AED',
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
INSERT INTO "new_AffiliateProfile" ("bankAccountName", "bankAccountNumber", "bankCountry", "bankIBAN", "bankName", "commissionRate", "createdAt", "id", "payoutCurrency", "pendingBalance", "referralCode", "totalEarned", "totalPaid", "updatedAt", "userId") SELECT "bankAccountName", "bankAccountNumber", "bankCountry", "bankIBAN", "bankName", "commissionRate", "createdAt", "id", "payoutCurrency", "pendingBalance", "referralCode", "totalEarned", "totalPaid", "updatedAt", "userId" FROM "AffiliateProfile";
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
    "commissionAmount" DECIMAL NOT NULL,
    "commissionAmountAed" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "kind" TEXT NOT NULL DEFAULT 'direct',
    "parentReferralId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateReferral_parentReferralId_fkey" FOREIGN KEY ("parentReferralId") REFERENCES "AffiliateReferral" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateReferral" ("affiliateId", "commissionAmount", "commissionAmountAed", "commissionRate", "createdAt", "currency", "id", "orderId", "orderTotal", "status") SELECT "affiliateId", "commissionAmount", "commissionAmountAed", "commissionRate", "createdAt", "currency", "id", "orderId", "orderTotal", "status" FROM "AffiliateReferral";
DROP TABLE "AffiliateReferral";
ALTER TABLE "new_AffiliateReferral" RENAME TO "AffiliateReferral";
CREATE UNIQUE INDEX "AffiliateReferral_parentReferralId_key" ON "AffiliateReferral"("parentReferralId");
CREATE UNIQUE INDEX "AffiliateReferral_orderId_kind_key" ON "AffiliateReferral"("orderId", "kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
