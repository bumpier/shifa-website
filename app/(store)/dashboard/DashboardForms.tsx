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

export function BankDetailsForm({
  defaults,
}: {
  defaults: {
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIBAN: string;
    bankCountry: string;
  };
}) {
  const [state, action] = useActionState(saveBankDetailsAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="bankName">Bank name</label>
        <input id="bankName" name="bankName" required minLength={2} maxLength={100} defaultValue={defaults.bankName} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="bankAccountName">Account holder name</label>
        <input id="bankAccountName" name="bankAccountName" required minLength={2} maxLength={100} defaultValue={defaults.bankAccountName} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="bankAccountNumber">Account number</label>
        <input id="bankAccountNumber" name="bankAccountNumber" required maxLength={40} defaultValue={defaults.bankAccountNumber} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="bankIBAN">IBAN (optional)</label>
        <input id="bankIBAN" name="bankIBAN" maxLength={40} defaultValue={defaults.bankIBAN} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="bankCountry">Bank country</label>
        <input id="bankCountry" name="bankCountry" required minLength={2} maxLength={60} defaultValue={defaults.bankCountry} className="field" />
      </div>

      <FormMessage state={state} />
      <SubmitButton>Save bank details</SubmitButton>
    </form>
  );
}
