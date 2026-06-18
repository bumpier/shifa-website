"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "@/app/(store)/auth/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action] = useActionState(resetPasswordAction, initial);

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
          Choose a new password
        </h1>

        {state.success ? (
          <div className="mt-6 space-y-4">
            <FormMessage state={state} />
            <Link href="/auth/login" className="btn-primary w-full">
              Go to sign in
            </Link>
          </div>
        ) : !token ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            This reset link is missing its token. Please use the link from your email.
          </p>
        ) : (
          <form action={action} className="mt-8 space-y-5">
            <input type="hidden" name="token" value={token} />
            <div>
              <label className="label" htmlFor="password">New password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                className="field"
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs text-ink-soft/70">
                At least 8 characters, with an uppercase letter and a number.
              </p>
            </div>

            <FormMessage state={state} />
            <SubmitButton>Update password</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
