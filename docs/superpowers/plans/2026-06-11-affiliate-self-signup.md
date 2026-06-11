# Affiliate Self-Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any user to register as an affiliate without an admin invite token, while keeping the existing invite flow working.

**Architecture:** Make the invite token optional across the validation schema, form component, page, and server action. When a token is present and valid it still marks the invite used; when absent the action creates the affiliate directly.

**Tech Stack:** Next.js App Router, Prisma, Zod, React `useActionState`

---

## File Map

| File | Change |
|------|--------|
| `lib/validation.ts` | `token` in `RegisterSchema` → optional |
| `app/(store)/auth/register/RegisterForm.tsx` | `token` prop → `string \| undefined`, hidden input conditional |
| `app/(store)/auth/register/page.tsx` | Always render `<RegisterForm>`, pass `token` only when invite is valid |
| `app/(store)/auth/actions.ts` | Invite lookup conditional on token presence in `registerAction` |

---

## Task 1: Make token optional in RegisterSchema

**Files:**
- Modify: `lib/validation.ts:40-47`

- [ ] **Step 1: Update RegisterSchema**

In `lib/validation.ts`, change `token: z.string().uuid()` to `z.string().uuid().optional()`:

```typescript
export const RegisterSchema = z
  .object({
    token: z.string().uuid().optional(),
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().max(254).toLowerCase(),
    password: passwordSchema,
  })
  .strict();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/validation.ts
git commit -m "feat: make affiliate register token optional in schema"
```

---

## Task 2: Update RegisterForm to accept optional token

**Files:**
- Modify: `app/(store)/auth/register/RegisterForm.tsx:10,26`

- [ ] **Step 1: Make token prop optional and render hidden input conditionally**

Replace the entire file with:

```typescript
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/(store)/auth/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

const initial: FormState = {};

export function RegisterForm({ token }: { token?: string }) {
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
      {token && <input type="hidden" name="token" value={token} />}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(store\)/auth/register/RegisterForm.tsx
git commit -m "feat: make RegisterForm token prop optional"
```

---

## Task 3: Update register page to always show form

**Files:**
- Modify: `app/(store)/auth/register/page.tsx`

- [ ] **Step 1: Rewrite page to always render the form**

Replace the entire file with:

```typescript
import Link from "next/link";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let validToken: string | undefined;

  if (token && z.string().uuid().safeParse(token).success) {
    const invite = await prisma.affiliateInvite.findUnique({ where: { token } });
    if (invite && !invite.usedAt && invite.expiresAt > new Date()) {
      validToken = token;
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <div className="card p-8">
        <p className="eyebrow">Affiliate programme</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-brand-deep">
          Create your account
        </h1>
        <RegisterForm token={validToken} />
      </div>
    </div>
  );
}
```

Note: the `Link` import is removed since the error block that used it is gone. The `inviteValid` boolean is replaced by the `validToken` variable which serves double duty as the boolean check and the value passed to the form.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(store\)/auth/register/page.tsx
git commit -m "feat: show affiliate register form without invite token"
```

---

## Task 4: Update registerAction to skip invite check when no token

**Files:**
- Modify: `app/(store)/auth/actions.ts:35-95`

- [ ] **Step 1: Rewrite registerAction**

Replace the `registerAction` function (lines 35–95) in `app/(store)/auth/actions.ts` with:

```typescript
export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!rateLimit(`register:${await ip()}`, 5, 60_000)) {
    return { error: "Too many attempts — please wait a minute." };
  }

  const rawToken = formData.get("token");
  const parsed = RegisterSchema.safeParse({
    token: typeof rawToken === "string" && rawToken ? rawToken : undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid details" };
  }
  const { token, name, email, password } = parsed.data;

  const invite = token
    ? await prisma.affiliateInvite.findUnique({ where: { token } })
    : null;

  if (token && (!invite || invite.usedAt || invite.expiresAt < new Date())) {
    return { error: "This invite link is invalid or has expired." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const referralCode = await uniqueReferralCode();
  const verifyToken = crypto.randomBytes(24).toString("hex");
  const defaultRate = parseFloat(process.env.AFFILIATE_DEFAULT_COMMISSION ?? "10");

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "affiliate",
        verifyToken,
        affiliateProfile: {
          create: { referralCode, commissionRate: defaultRate },
        },
      },
    });
    if (invite) {
      await tx.affiliateInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedByUserId: created.id },
      });
    }
    return created;
  });

  await sendVerificationEmail(user.email, verifyToken);

  return {
    success:
      "Account created. Check your inbox for a verification link, then sign in.",
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(store\)/auth/actions.ts
git commit -m "feat: allow affiliate self-signup without invite token"
```

---

## Task 5: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Self-signup path — visit register page with no token**

Open `http://localhost:3000/auth/register` in a browser.

Expected: the "Create your account" form is visible with name/email/password fields (no error block about invalid invite).

- [ ] **Step 3: Submit a self-signup**

Fill in a name, a fresh email, and a valid password (8+ chars, uppercase, number). Submit.

Expected: success message "Account created. Check your inbox for a verification link, then sign in." with a "Go to sign in" button.

- [ ] **Step 4: Verify the affiliate profile was created**

Check the database or admin panel at `http://localhost:3000/admin/affiliates`.

Expected: the newly registered user appears in the affiliates list with an auto-generated referral code and the default commission rate.

- [ ] **Step 5: Invite path — verify it still works**

Generate an invite via `http://localhost:3000/admin/affiliates/invite`. Copy the full URL (includes `?token=…`). Open it in a fresh browser/incognito window.

Expected: the form shows. Register with a different email. The invite should be marked as used (disappears from the "Unused invites" list).

- [ ] **Step 6: Invalid token path — verify it still rejects**

Visit `http://localhost:3000/auth/register?token=00000000-0000-0000-0000-000000000000`.

Expected: the form shows (not an error page), but submitting returns "This invite link is invalid or has expired."
