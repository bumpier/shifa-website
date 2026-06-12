# USDT-only affiliate tracking + crypto payouts — design

Date: 2026-06-12
Status: approved

## Summary

Affiliate commissions switch from AED to **USDT** as the single unit of
account, and payouts switch from manual bank transfer to **manual USDT
transfer on TRC20 (Tron)**. Bank detail fields are removed entirely and
replaced by a single encrypted TRC20 wallet address. Existing affiliate
referral/payout records and balances are **wiped** (all test data).

Since USDT is dollar-pegged, the commission basis is the order's USD
subtotal computed at order time from existing `priceUsd` product prices —
no exchange-rate feed needed.

## Decisions

- Networks: **TRC20 only**. Address validated as `T` + 33 base58 chars
  (`/^T[1-9A-HJ-NP-Za-km-z]{33}$/`).
- Existing data: wipe `AffiliateReferral` and `PayoutRequest` rows, reset
  `totalEarned` / `totalPaid` / `pendingBalance` to 0 (pre-launch test data).
- Minimum payout: `AFFILIATE_MIN_PAYOUT_USDT` env, default **25**
  (replaces `AFFILIATE_MIN_PAYOUT_AED=100`).
- Payout processing: stays manual. Admin sends USDT from own wallet,
  records the **tx hash**, marks the request paid. No NOWPayments payout
  API.
- Payout expectation notice: the dashboard payout card shows
  **"Payouts are processed manually within 24–48 hours of your request."**
  near the request button, and the success message after requesting
  repeats it.
- Commission and override percentage rules are unchanged (10% default,
  2.5% master override, same lifecycle and clawback behaviour).

## Schema (one migration)

`Order`:
- `subtotalAed` → `subtotalUsd` (commission basis, computed at order time
  from product/variant `priceUsd`, same 10% repeat-customer discount
  applied as the old AED basis).

`AffiliateProfile`:
- Remove `bankName`, `bankAccountName`, `bankAccountNumber`, `bankIBAN`,
  `bankCountry`, `payoutCurrency`.
- Add `usdtAddress String?` — TRC20 address, AES-256-GCM encrypted at
  rest via `lib/encrypt.ts` (same treatment the bank fields had).
- `totalEarned` / `totalPaid` / `pendingBalance` now denominated in USDT;
  reset to 0 in the migration.

`AffiliateReferral`:
- `commissionAmount` + `commissionAmountAed` → single
  `commissionAmountUsdt`. `orderTotal` and `currency` (the customer's
  order currency) stay for audit. Existing rows deleted.

`PayoutRequest`:
- `currency` default `"USDT"`.
- `bankSnapshot` → `walletSnapshot` (JSON `{usdtAddress, network:"TRC20"}`
  with the encrypted address, captured at request time).
- Add `txHash String?` — set by admin when marking paid.
- Existing rows deleted.

## Flows

**Checkout (`/api/checkout`)**: compute `subtotalUsd` exactly as
`subtotalAed` was computed, but from `priceUsd` (variant-aware, discount
applied).

**Webhook commission creation (`createReferralForPaidOrder`)**: commission
= `subtotalUsd × rate%`, stored as `commissionAmountUsdt` (2dp). Override
likewise. Approve/reject/clawback increment/decrement balances in USDT —
logic unchanged, field renamed.

**Affiliate dashboard**:
- Bank details form → "USDT wallet (TRC20)" form: one address field with
  helper text warning that payouts are sent only as USDT on TRC20 and a
  wrong-network address means lost funds.
- All amounts display as `X.XX USDT` (replaces `formatPrice(..., "AED")`
  and the payout-currency selector logic).
- Payout request requires a saved wallet address; minimum 25 USDT; the
  24–48h processing notice appears on the payout card and in the
  post-request success message.

**Admin**:
- Affiliate list/detail show USDT amounts; detail page shows the
  (decrypted) wallet address instead of bank details.
- Payout request processing gains a tx-hash field: admin pastes the
  TRC20 transaction hash when marking a payout paid; stored on the
  request and shown to the affiliate in payout history.

**Validation (`lib/validation.ts`)**: `BankDetailsSchema` →
`WalletSchema` (`usdtAddress` with the TRC20 regex). Remove
`payoutCurrency` enum usage.

## Env

```
AFFILIATE_MIN_PAYOUT_USDT=25   # replaces AFFILIATE_MIN_PAYOUT_AED
```

`.env.example`, README and docs/CLAUDE.md updated to match.

## Out of scope

- Automated payouts (NOWPayments mass-payout API).
- Other networks (ERC20/BEP20) or other coins.
- Historical AED conversion — data is wiped instead.
