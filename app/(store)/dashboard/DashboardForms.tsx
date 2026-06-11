"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { FormState } from "@/app/(store)/auth/actions";
import { requestPayoutAction, saveBankDetailsAction } from "./actions";

const initial: FormState = {};

export function PayoutButton({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(requestPayoutAction, initial);

  return (
    <form action={action} className="mt-4 space-y-3">
      <FormMessage state={state} />
      <button type="submit" disabled={disabled} className="btn-primary w-full">
        Request payout
      </button>
    </form>
  );
}

const SUPPORTED_CURRENCIES = [
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "PKR", label: "PKR — Pakistani Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
] as const;

export function BankDetailsForm({
  defaults,
}: {
  defaults: {
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIBAN: string;
    bankCountry: string;
    payoutCurrency: string;
  };
}) {
  const [state, action] = useActionState(saveBankDetailsAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="payoutCurrency">Payout currency</label>
        <select id="payoutCurrency" name="payoutCurrency" defaultValue={defaults.payoutCurrency} className="field">
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          Commissions are calculated in AED. Payouts in other currencies are sent at the rate applied by your bank.
          We do not cover conversion fees, international transfer fees, or any charges applied by intermediary banks.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="bankName">Bank name</label>
        <input id="bankName" name="bankName" required minLength={2} maxLength={100} defaultValue={defaults.bankName} className="field" autoComplete="organization" />
      </div>
      <div>
        <label className="label" htmlFor="bankAccountName">Account holder name</label>
        <input id="bankAccountName" name="bankAccountName" required minLength={2} maxLength={100} defaultValue={defaults.bankAccountName} className="field" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="bankAccountNumber">Account number</label>
        <input id="bankAccountNumber" name="bankAccountNumber" required maxLength={40} defaultValue={defaults.bankAccountNumber} className="field" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="bankIBAN">IBAN (optional)</label>
        <input id="bankIBAN" name="bankIBAN" maxLength={40} defaultValue={defaults.bankIBAN} className="field" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="bankCountry">Bank country</label>
        <input id="bankCountry" name="bankCountry" required minLength={2} maxLength={60} defaultValue={defaults.bankCountry} className="field" autoComplete="country-name" />
      </div>

      <FormMessage state={state} />
      <SubmitButton>Save bank details</SubmitButton>
    </form>
  );
}
