# Pyramid referral system — design

Date: 2026-06-12
Status: approved

## Summary

Extend the existing single-tier affiliate system with one level of recruitment.
A **master** affiliate gets a permanent recruit link; affiliates who sign up
through it become their **recruits**. The master earns a **2.5% override**
(paid by the house, on top of the recruit's own commission) on every confirmed
sale a direct recruit generates. Overrides do not cascade: a master earns
nothing from their recruits' recruits.

An affiliate becomes **eligible** for master status after 10 confirmed sales
(commissions with status `approved` or `paid`, past sales included). Promotion
is a manual admin action; admins can also demote.

## Decisions

- Recruitment: permanent link `/auth/register?recruiter=CODE` (the affiliate's
  existing referral code doubles as recruit code). Captured via a 30-day
  `recruit_code` cookie set in middleware, read at registration.
- Confirmed sale = admin-approved commission (`approved` or `paid`).
- Override is 2.5% of `order.subtotalAed`, configurable via
  `MASTER_OVERRIDE_PERCENT` env (default 2.5). Threshold configurable via
  `MASTER_SALES_THRESHOLD` (default 10).
- Override rides along with the recruit's direct commission: created in the
  same webhook transaction, approved/rejected/clawed back in the same admin
  action. Overrides never appear as separate approval decisions.
- Master status is checked at order-payment time: demoted/suspended masters
  stop accruing overrides immediately, including from existing recruits.
- Promotion: admin sees an "eligible" badge (live count, so history counts)
  and clicks Promote on the affiliate detail page. Promotion email sent via
  Resend with the recruit link.

## Schema (one migration)

`AffiliateProfile`:
- `recruiterId String?` — self-referential FK to the recruiting profile
  (relation `Recruits`), set once at registration, never changed.
- `isMaster Boolean @default(false)`, `masterAt DateTime?`

`AffiliateReferral`:
- `kind String @default("direct")` — `direct` | `override`
- `parentReferralId String? @unique` — links an override to the direct
  commission it derives from (self-relation `OverrideOf`).
- `orderId` uniqueness becomes `@@unique([orderId, kind])` (two rows per
  order max: one direct, one override). `Order.referral` becomes
  `referrals AffiliateReferral[]`.

## Flows

**Webhook (`createReferralForPaidOrder`)**: create direct commission; if the
sub's profile has a `recruiterId` whose profile `isMaster` and user is active,
create the override row (2.5% of subtotalAed, `parentReferralId` set) in the
same transaction.

**Approve/reject (`approveReferral` / `rejectReferral`)**: operate on the
direct referral, then cascade the same state change (including balance
increments / clawbacks) to the linked override in the same transaction.
Admin UI only offers buttons on `direct` rows.

**Registration**: read `recruit_code` cookie → resolve to a master profile →
set `recruiterId`. Invalid/non-master codes are silently ignored.

**Payouts**: unchanged — overrides share the table, balances and the
`approved → paid` sweep, so they're included automatically.

## UI

- Affiliate dashboard: non-masters see "X / 10 confirmed sales" progress;
  masters see recruit link, recruits table (name, joined, confirmed sales,
  override earned), and an override badge in the referrals table.
- Admin affiliates list: Master / Eligible badge column.
- Admin affiliate detail: master status with Promote/Demote, recruiter name,
  recruits count, `kind` shown in referral history.
- Admin order detail: switches from `order.referral` to the direct row of
  `order.referrals`.

## Out of scope

- Multi-level overrides (explicitly one level only).
- Automatic promotion.
- NOWPayments webhook does not currently create commissions at all
  (pre-existing gap, unchanged by this work).
