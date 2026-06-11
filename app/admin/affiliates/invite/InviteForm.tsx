"use client";

import { useActionState } from "react";
import { createInviteAction } from "@/app/admin/actions";
import type { FormState } from "@/app/(store)/auth/actions";
import { SubmitButton } from "@/components/forms";
import { CopyButton } from "@/components/CopyButton";

const initial: FormState = {};

export function InviteForm() {
  const [state, action] = useActionState(createInviteAction, initial);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5">
        <div>
          <label className="label" htmlFor="email">Email (optional, sends the invite)</label>
          <input id="email" name="email" type="email" maxLength={254} className="field" placeholder="partner@example.com" />
        </div>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <SubmitButton>Generate invite link</SubmitButton>
      </form>

      {state.success && (
        <div className="rounded-xl bg-brand-tint p-4">
          <p className="eyebrow mb-2">Invite link (48h, single use)</p>
          <p className="break-all font-mono text-xs text-ink">{state.success}</p>
          <div className="mt-3">
            <CopyButton text={state.success} />
          </div>
        </div>
      )}
    </div>
  );
}
