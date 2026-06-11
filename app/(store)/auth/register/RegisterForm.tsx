"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/(store)/auth/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export function RegisterForm({ token }: { token: string }) {
  const [state, action] = useActionState(registerAction, initial);

  if (state.success) {
    return (
      <div className="mt-6 space-y-4">
        <FormMessage state={state} />
        <Link href="/auth/login" className="btn-primary w-full">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input id="name" name="name" required minLength={2} maxLength={100} className="field" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required maxLength={254} className="field" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
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
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
