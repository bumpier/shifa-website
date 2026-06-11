"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/(store)/auth/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, initial);

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Affiliate area</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
          Sign in
        </h1>

        <form action={action} className="mt-8 space-y-5">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required maxLength={254} className="field" autoComplete="email" spellCheck={false} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required maxLength={128} className="field" autoComplete="current-password" />
          </div>

          <FormMessage state={state} />
          <SubmitButton>Sign in</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link href="/auth/forgot-password" className="text-brand hover:underline">
            Forgot your password?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-ink-soft">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-brand hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
