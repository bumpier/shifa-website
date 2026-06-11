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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AffiliateProfile" ("bankAccountName", "bankAccountNumber", "bankCountry", "bankIBAN", "bankName", "commissionRate", "createdAt", "id", "pendingBalance", "referralCode", "totalEarned", "totalPaid", "updatedAt", "userId") SELECT "bankAccountName", "bankAccountNumber", "bankCountry", "bankIBAN", "bankName", "commissionRate", "createdAt", "id", "pendingBalance", "referralCode", "totalEarned", "totalPaid", "updatedAt", "userId" FROM "AffiliateProfile";
DROP TABLE "AffiliateProfile";
ALTER TABLE "new_AffiliateProfile" RENAME TO "AffiliateProfile";
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
