"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type FormState } from "@/app/(store)/auth/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, initial);

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
          Reset your password
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Enter your email and we will send you a reset link, valid for one hour.
        </p>

        <form action={action} className="mt-8 space-y-5">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required maxLength={254} className="field" autoComplete="email" />
          </div>

          <FormMessage state={state} />
          <SubmitButton>Send reset link</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
