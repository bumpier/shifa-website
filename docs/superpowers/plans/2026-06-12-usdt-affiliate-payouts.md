# USDT-Only Affiliate Tracking + TRC20 Crypto Payouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Affiliate commissions are tracked in USDT (USD-pegged) instead of AED, and payouts switch from bank transfer to manual USDT transfers on TRC20, with a 24–48h processing notice.

**Architecture:** The commission basis moves from `Order.subtotalAed` to `Order.subtotalUsd` (computed at checkout from existing `priceUsd` product prices). Bank fields on `AffiliateProfile` are replaced by one encrypted TRC20 address. `PayoutRequest` snapshots the wallet and records a tx hash when the admin marks it paid. All affiliate-facing and admin amounts display as `X.XX USDT`. Existing affiliate referral/payout test data is wiped in the migration.

**Tech Stack:** Next.js 15 App Router, Prisma 5 + SQLite, Zod, tsx smoke scripts (no test runner in this project — verification is `npm run build` + smoke scripts, per project convention).

**Spec:** `docs/superpowers/specs/2026-06-12-usdt-affiliate-payouts-design.md`

---

### Task 1: Schema + migration (wipes affiliate test data)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_usdt_affiliate_payouts/migration.sql` (generated, then hand-edited)

- [ ] **Step 1: Edit `prisma/schema.prisma`**

`Order` — replace the `subtotalAed` line:

```prisma
  subtotalUsd     Decimal  @default(0) // commission basis (USD ≈ USDT), computed at order time
```

`AffiliateProfile` — replace the five `bank*` fields + `payoutCurrency` block and re-comment the totals:

```prisma
  // USDT (TRC20) payout address — AES-256-GCM encrypted at rest (lib/encrypt.ts)
  usdtAddress     String?
  totalEarned     Decimal  @default(0) // USDT, approved + paid
  totalPaid       Decimal  @default(0) // USDT
  pendingBalance  Decimal  @default(0) // USDT, approved but unpaid
```

`AffiliateReferral` — replace `commissionAmount` + `commissionAmountAed` with:

```prisma
  commissionAmountUsdt Decimal // USDT (≈ USD); basis = order.subtotalUsd
```

`PayoutRequest` — `currency` default becomes `"USDT"`, `bankSnapshot` becomes `walletSnapshot`, add `txHash`:

```prisma
  amount         Decimal // USDT
  currency       String    @default("USDT")
  status         String    @default("requested") // requested | processing | paid | rejected
  walletSnapshot String // JSON {usdtAddress (encrypted), network:"TRC20"} at request time
  txHash         String? // TRC20 transaction hash, set by admin when marking paid
  adminNote      String?
```

- [ ] **Step 2: Generate the migration without applying**

Run: `npx prisma migrate dev --name usdt_affiliate_payouts --create-only`

- [ ] **Step 3: Hand-edit the generated migration to wipe affiliate data first**

Prepend to the generated `migration.sql` (before the `PRAGMA`/`RedefineTables` section):

```sql
-- Pre-launch reset: affiliate money data switches unit of account to USDT.
DELETE FROM "AffiliateReferral";
DELETE FROM "PayoutRequest";
UPDATE "AffiliateProfile" SET "totalEarned" = 0, "totalPaid" = 0, "pendingBalance" = 0;
```

Check the generated `INSERT INTO "new_Order" ... SELECT` keeps the rename safe: `subtotalUsd` is new with default 0, old `subtotalAed` is dropped (old orders are test data; their basis doesn't matter once referrals are wiped).

- [ ] **Step 4: Apply and regenerate the client**

Run: `npx prisma migrate dev`
Expected: migration applied, `prisma generate` runs clean.

- [ ] **Step 5: Commit**

```bash
git add prisma
git commit -m "feat: schema for USDT affiliate tracking and TRC20 payouts"
```

---

### Task 2: Checkout computes `subtotalUsd`; crypto branch reuses it

**Files:**
- Modify: `app/api/checkout/route.ts:48-90,110,119-146`

- [ ] **Step 1: Compute USD basis in the pricing loop**

Replace `let subtotalAed = new Prisma.Decimal(0);` with `let subtotalUsd = new Prisma.Decimal(0);` and inside the items map, alongside the existing currency price, resolve the USD price (this also fixes a latent bug: the old crypto branch looked for `item.variantLabel` on `orderItems`, which never had that field, so variant USD prices fell back to base prices):

```ts
      let unitPriceStr: string;
      let unitPriceUsdStr: string;
      if (line.variantLabel) {
        const vPrice = priceForVariant(product, line.variantLabel, input.currency);
        const vPriceUsd = priceForVariant(product, line.variantLabel, "USD");
        if (!vPrice || !vPriceUsd) {
          throw Object.assign(new Error("variant"), { code: "INVALID_VARIANT" });
        }
        unitPriceStr = vPrice;
        unitPriceUsdStr = vPriceUsd;
      } else {
        unitPriceStr = priceFor(product, input.currency);
        unitPriceUsdStr = priceFor(product, "USD");
      }

      const unitPrice = new Prisma.Decimal(unitPriceStr);
      const unitPriceUsd = new Prisma.Decimal(unitPriceUsdStr);
      total = total.add(unitPrice.mul(line.qty));
      subtotalUsd = subtotalUsd.add(unitPriceUsd.mul(line.qty));
```

Keep the order-items JSON shape but rename the audit field: `unitPriceAed: unitPriceAed.toFixed(2)` → `unitPriceUsd: unitPriceUsd.toFixed(2)`.

Discount block becomes:

```ts
    if (isCrypto) {
      const discount = total.mul(0.1); // 10% off
      total = total.sub(discount);
      subtotalUsd = subtotalUsd.mul(0.9); // also apply to USD basis
    }
```

Order create: `subtotalAed,` → `subtotalUsd,`.

- [ ] **Step 2: Replace the crypto branch's USD re-computation**

Delete the `let totalUsd = ...` loop (lines ~120-138) and pass the already-computed basis:

```ts
    if (isCrypto) {
      const cryptoPayment = await createCryptoPayment({
        orderId: order.id,
        amount: subtotalUsd.toFixed(2), // USD total with 10% discount already applied
        method: input.paymentMethod as CryptoPaymentMethod,
        customerName: input.name,
        customerEmail: input.email,
      });
```

- [ ] **Step 3: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat: checkout computes USD commission basis (subtotalUsd)"
```

---

### Task 3: Commission engine in USDT

**Files:**
- Modify: `lib/affiliate.ts:48-141`

- [ ] **Step 1: Rename amounts**

- Doc comment on `createReferralForPaidOrder`: "Creates a pending commission for the referring affiliate, in USDT, based on the USD subtotal computed at order time."
- `commissionAed` → `commissionUsdt`, computed from `order.subtotalUsd`:

```ts
  const rate = new Prisma.Decimal(profile.commissionRate);
  const commissionUsdt = new Prisma.Decimal(order.subtotalUsd).mul(rate).div(100).toDecimalPlaces(2);
```

- `overrideAed` → `overrideUsdt` (same change, `order.subtotalUsd` basis).
- Both `affiliateReferral.create` calls: replace the two fields `commissionAmount` / `commissionAmountAed` with one `commissionAmountUsdt: commissionUsdt` (and `overrideUsdt` for the override row).
- `approveInTx` / `rejectInTx`: `ref.commissionAmountAed` → `ref.commissionAmountUsdt` (4 occurrences).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in files not yet migrated (dashboard/admin/smoke) referencing old fields — none in `lib/affiliate.ts` or `app/api/checkout/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/affiliate.ts
git commit -m "feat: commission engine tracks USDT amounts"
```

---

### Task 4: Validation schema + USDT formatter

**Files:**
- Modify: `lib/validation.ts:68-77`
- Modify: `config/brand.ts` (after `formatPrice`)

- [ ] **Step 1: Replace `BankDetailsSchema` with `WalletSchema`**

```ts
export const WalletSchema = z
  .object({
    // TRC20 (Tron) address: "T" + 33 base58 chars
    usdtAddress: z
      .string()
      .trim()
      .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "Enter a valid USDT (TRC20) address"),
  })
  .strict();
```

- [ ] **Step 2: Add `formatUsdt` to `config/brand.ts`**

```ts
/** Affiliate amounts are tracked and paid in USDT (TRC20). */
export function formatUsdt(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} USDT`;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/validation.ts config/brand.ts
git commit -m "feat: TRC20 wallet validation and USDT formatter"
```

---

### Task 5: Affiliate dashboard actions (wallet save + USDT payout request)

**Files:**
- Modify: `app/(store)/dashboard/actions.ts`

- [ ] **Step 1: Replace `saveBankDetailsAction` with `saveWalletAction`**

```ts
export async function saveWalletAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await getCurrentAffiliate();
  if (!user?.affiliateProfile) return { error: "Session expired. Please sign in again." };

  const parsed = WalletSchema.safeParse({ usdtAddress: formData.get("usdtAddress") });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid wallet address" };
  }

  await prisma.affiliateProfile.update({
    where: { id: user.affiliateProfile.id },
    data: {
      // Encrypted at rest — AES-256-GCM
      usdtAddress: encrypt(parsed.data.usdtAddress),
    },
  });

  revalidatePath("/dashboard");
  return { success: "Wallet address saved." };
}
```

Import `WalletSchema` instead of `BankDetailsSchema`.

- [ ] **Step 2: Update `requestPayoutAction`**

```ts
  const minPayout = new Prisma.Decimal(process.env.AFFILIATE_MIN_PAYOUT_USDT ?? "25");
  const balance = new Prisma.Decimal(profile.pendingBalance);

  if (balance.lessThan(minPayout)) {
    return { error: `Minimum payout is ${minPayout.toFixed(2)} USDT.` };
  }
  if (!profile.usdtAddress) {
    return { error: "Add your USDT (TRC20) wallet address before requesting a payout." };
  }
```

and the create + success message:

```ts
  await prisma.payoutRequest.create({
    data: {
      affiliateId: profile.id,
      amount: balance,
      currency: "USDT",
      status: "requested",
      // Snapshot of the (encrypted) wallet at time of request
      walletSnapshot: JSON.stringify({
        usdtAddress: profile.usdtAddress,
        network: "TRC20",
      }),
    },
  });

  revalidatePath("/dashboard");
  return {
    success:
      "Payout requested. Payouts are processed manually and sent within 24–48 hours.",
  };
```

- [ ] **Step 3: Commit**

```bash
git add "app/(store)/dashboard/actions.ts"
git commit -m "feat: wallet save and USDT payout request actions"
```

---

### Task 6: Affiliate dashboard UI (wallet form, USDT amounts, 24–48h notice)

**Files:**
- Modify: `app/(store)/dashboard/DashboardForms.tsx`
- Modify: `app/(store)/dashboard/page.tsx`

- [ ] **Step 1: Replace `BankDetailsForm` with `WalletForm` in `DashboardForms.tsx`**

Delete `SUPPORTED_CURRENCIES` and `BankDetailsForm`; add:

```tsx
export function WalletForm({ defaults }: { defaults: { usdtAddress: string } }) {
  const [state, action] = useActionState(saveWalletAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="usdtAddress">USDT wallet address (TRC20)</label>
        <input
          id="usdtAddress"
          name="usdtAddress"
          required
          minLength={34}
          maxLength={34}
          defaultValue={defaults.usdtAddress}
          placeholder="T..."
          className="field font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          Payouts are sent only as USDT on the TRC20 (Tron) network. Double-check this
          address — funds sent to a wrong or non-TRC20 address cannot be recovered.
        </p>
      </div>

      <FormMessage state={state} />
      <SubmitButton>Save wallet address</SubmitButton>
    </form>
  );
}
```

Update the import: `import { requestPayoutAction, saveWalletAction } from "./actions";`

- [ ] **Step 2: Update `page.tsx`**

- Imports: drop `convertFromAed`; `import { formatPrice, formatUsdt, type Currency } from "@/config/brand";` and import `WalletForm` instead of `BankDetailsForm`.
- Replace the conversion block:

```ts
  const minPayout = parseFloat(process.env.AFFILIATE_MIN_PAYOUT_USDT ?? "25");
  const pending = parseFloat(profile.pendingBalance.toString());
  const hasWallet = !!profile.usdtAddress;
  const fmt = (v: number | string) => formatUsdt(v);
```

- All `o.commissionAmountAed` / `r.commissionAmountAed` → `commissionAmountUsdt`.
- Referral-link copy: "paid out in {pc}." → "paid out in USDT."; recruits table header `Your earnings ({pc})` → `Your earnings (USDT)`; referrals table header `Commission ({pc})` → `Commission (USDT)`.
- Payout history `formatPrice(p.amount.toString(), p.currency as Currency)` → `formatUsdt(p.amount.toString())`, and add a tx-hash line under the status when present:

```tsx
                        <td className="px-5 py-3 capitalize text-ink-soft">
                          {p.status}
                          {p.txHash && (
                            <a
                              href={`https://tronscan.org/#/transaction/${p.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 font-mono text-xs normal-case text-brand underline"
                            >
                              {p.txHash.slice(0, 10)}…
                            </a>
                          )}
                        </td>
```

- Payout request card — swap `hasBank` for `hasWallet` and add the processing-time notice:

```tsx
          <div className="card p-6">
            <p className="eyebrow mb-3">Request a payout</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              Your approved balance is{" "}
              <span className="font-semibold text-brand-deep">
                {fmt(profile.pendingBalance.toString())}
              </span>
              . Minimum payout is {fmt(minPayout)}.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-amber-700">
              Payouts are processed manually and sent in USDT (TRC20) within 24–48 hours
              of your request — they are not instant.
            </p>
            <PayoutButton disabled={pending < minPayout || !hasWallet} />
            {!hasWallet && (
              <p className="mt-3 text-xs text-amber-700">
                Add your USDT wallet address below to enable payouts.
              </p>
            )}
          </div>
```

- Wallet card replaces the bank card:

```tsx
          <div className="card p-6">
            <p className="eyebrow mb-3">Payout wallet</p>
            <p className="mb-5 text-xs leading-relaxed text-ink-soft">
              Where your USDT payouts are sent. Stored encrypted.
            </p>
            <WalletForm defaults={{ usdtAddress: tryDecrypt(profile.usdtAddress) ?? "" }} />
          </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors under `app/(store)/dashboard/`.

- [ ] **Step 4: Commit**

```bash
git add "app/(store)/dashboard"
git commit -m "feat: dashboard shows USDT amounts, wallet form, 24-48h payout notice"
```

---

### Task 7: Admin — tx hash on payouts, wallet display, USDT amounts

**Files:**
- Modify: `app/admin/actions.ts:310-348`
- Modify: `app/admin/affiliates/[id]/page.tsx`
- Modify: `app/admin/affiliates/page.tsx:97-98`
- Modify: `app/admin/page.tsx` + `components/admin/AnalyticsDashboard.tsx`

- [ ] **Step 1: `processPayoutAction` accepts a tx hash**

```ts
  const rawHash = formData.get("txHash");
  const txHash =
    typeof rawHash === "string" && /^[0-9a-fA-F]{64}$/.test(rawHash.trim())
      ? rawHash.trim().toLowerCase()
      : null;
```

and include it in the update: `data: { status: decision, adminNote, txHash, processedAt: ... }` — only set when paying:

```ts
      data: {
        status: decision,
        adminNote,
        txHash: decision === "paid" ? txHash : null,
        processedAt: decision === "processing" ? null : new Date(),
      },
```

- [ ] **Step 2: Affiliate detail page (`[id]/page.tsx`)**

- Import `formatUsdt`; stats use `formatUsdt(...)` instead of `formatPrice(..., "AED")`.
- Replace the `bank` object and "Bank details" card with a wallet card:

```tsx
        <div className="card p-6">
          <p className="eyebrow mb-4">Payout wallet (decrypted)</p>
          {wallet ? (
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Network</dt>
                <dd className="font-medium">USDT · TRC20</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Address</dt>
                <dd className="font-mono text-xs break-all">{wallet}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">Not provided yet.</p>
          )}
        </div>
```

with `const wallet = tryDecrypt(profile.usdtAddress);` above.

- Referral table: header `Commission (AED)` → `Commission (USDT)`; cell `formatPrice(r.commissionAmountAed.toString(), "AED")` → `formatUsdt(r.commissionAmountUsdt.toString())`.
- Payout request cards: amount `formatPrice(p.amount...)` → `formatUsdt(p.amount.toString())`; show the snapshot address and tx hash; add a tx-hash input to the action form:

```tsx
                    <p className="mt-1 font-mono text-xs text-ink-soft break-all">
                      {tryDecrypt((JSON.parse(p.walletSnapshot) as { usdtAddress?: string }).usdtAddress ?? null) ?? "no wallet snapshot"}{" "}
                      · TRC20
                    </p>
                    {p.txHash && (
                      <p className="mt-1 font-mono text-xs text-ink-soft break-all">tx: {p.txHash}</p>
                    )}
```

and inside the pending form, before the note input:

```tsx
                      <input
                        name="txHash"
                        maxLength={64}
                        placeholder="TRC20 tx hash (for Mark paid)"
                        className="field !w-64 !py-2 font-mono text-xs"
                      />
```

- [ ] **Step 3: Affiliate list page**

`formatPrice(a.pendingBalance.toString(), "AED")` → `formatUsdt(a.pendingBalance.toString())` (same for `totalEarned`); update imports and any "AED" column headers on that page to "USDT".

- [ ] **Step 4: Admin analytics**

In `app/admin/page.tsx`: `subtotalAed` → `subtotalUsd` (3 places), `totalRevenueAed` → `totalRevenueUsd`, label `Revenue (AED)` → `Revenue (USD)`, `formatPrice(revenueDecimal.toString(), "AED")` → `formatPrice(revenueDecimal.toString(), "USD")`.
In `components/admin/AnalyticsDashboard.tsx`: rename prop `totalRevenueAed` → `totalRevenueUsd` and the `AED {...}` display prefix → `$ {...}` (or `USD`, matching existing style at line 76).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` — expected: only `scripts/smoke-pyramid.ts` / `scripts/smoke-nudge.ts` errors remain.

```bash
git add app/admin components/admin
git commit -m "feat: admin USDT amounts, wallet display, payout tx hash"
```

---

### Task 8: Smoke scripts + env/docs

**Files:**
- Modify: `scripts/smoke-pyramid.ts`, `scripts/smoke-nudge.ts`
- Modify: `.env.example`, `README.md`, `docs/CLAUDE.md`

- [ ] **Step 1: Smoke scripts**

- Both scripts: `subtotalAed:` → `subtotalUsd:` in order fixtures.
- `smoke-pyramid.ts`: `commissionAmountAed` → `commissionAmountUsdt` in both asserts (values unchanged — 10%/2.5% of 1000).

- [ ] **Step 2: Run the pyramid smoke script**

Run: `npx tsx scripts/smoke-pyramid.ts`
Expected: all asserts pass (commission creation, cascade approve/reject, balances).

- [ ] **Step 3: Env + docs**

`.env.example`: `AFFILIATE_MIN_PAYOUT_AED=100` → `AFFILIATE_MIN_PAYOUT_USDT=25` with comment `# minimum payout threshold in USDT (TRC20)`.
`README.md` + `docs/CLAUDE.md`: update affiliate sections — commissions tracked in USDT (USD basis at order time), payouts manual USDT/TRC20 within 24–48h, wallet address replaces bank details, env var rename.

- [ ] **Step 4: Commit**

```bash
git add scripts .env.example README.md docs/CLAUDE.md
git commit -m "chore: smoke scripts, env and docs for USDT affiliate payouts"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full grep for stragglers**

Run: `grep -rn "subtotalAed\|commissionAmountAed\|payoutCurrency\|bankSnapshot\|bankAccountNumber\|MIN_PAYOUT_AED\|BankDetailsSchema" app lib components scripts prisma/schema.prisma .env.example`
Expected: no matches.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 3: Smoke scripts once more against fresh state**

Run: `npx tsx scripts/smoke-pyramid.ts && npx tsx scripts/smoke-nudge.ts`
Expected: both pass.
