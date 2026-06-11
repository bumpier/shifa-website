-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_aed" DECIMAL NOT NULL,
    "price_pkr" DECIMAL NOT NULL,
    "price_usd" DECIMAL NOT NULL,
    "price_gbp" DECIMAL NOT NULL,
    "images" TEXT NOT NULL DEFAULT '[]',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "subtotalAed" DECIMAL NOT NULL DEFAULT 0,
    "paykassmaRef" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "refCode" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'affiliate',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "emailVerifiedAt" DATETIME,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExp" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "commissionRate" DECIMAL NOT NULL DEFAULT 10.0,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIBAN" TEXT,
    "bankCountry" TEXT,
    "totalEarned" DECIMAL NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderTotal" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL,
    "commissionRate" DECIMAL NOT NULL,
    "commissionAmount" DECIMAL NOT NULL,
    "commissionAmountAed" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffiliateReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedByUserId" TEXT,
    CONSTRAINT "AffiliateInvite_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "bankSnapshot" TEXT NOT NULL,
    "adminNote" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    CONSTRAINT "PayoutRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_verifyToken_key" ON "User"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateReferral_orderId_key" ON "AffiliateReferral"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateInvite_token_key" ON "AffiliateInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateInvite_usedByUserId_key" ON "AffiliateInvite"("usedByUserId");
