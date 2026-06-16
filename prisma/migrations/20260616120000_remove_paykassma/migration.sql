-- Payments are now crypto-only (NOWPayments). Paykassma (card / JazzCash /
-- Easypaisa) has been removed. Rename the gateway reference column to a
-- provider-neutral name; existing data is preserved.
ALTER TABLE "Order" RENAME COLUMN "paykassmaRef" TO "paymentRef";
