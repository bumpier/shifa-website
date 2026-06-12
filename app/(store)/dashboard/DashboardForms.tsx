"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { FormState } from "@/app/(store)/auth/actions";
import { requestPayoutAction, saveWalletAction } from "./actions";

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
