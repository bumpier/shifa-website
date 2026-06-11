# Affiliate Self-Signup Design

**Date:** 2026-06-11
**Status:** Approved

## Goal

Allow any user to register as an affiliate without an admin-issued invite. The existing admin invite flow is preserved alongside open signup.

## Approach

Make the invite token optional on the existing `/auth/register` page. No new pages, no new actions, no DB changes.

## Changes

### `lib/validation.ts` — RegisterSchema

`token` changes from `z.string().uuid()` to `z.string().uuid().optional()`. All other fields (name, email, password) are unchanged.

### `app/(store)/auth/register/page.tsx`

Remove the guard that blocks the form when no valid token is present. Always render `<RegisterForm>`. Pass `token` only when a valid invite exists — the form uses it to pre-fill the hidden input. An absent or invalid token no longer shows the error block; the form renders either way.

### `app/(store)/auth/actions.ts` — `registerAction`

- Invite lookup is conditional: only run `affiliateInvite.findUnique` when a token is supplied.
- If a token is present but invalid/expired, return an error (existing behaviour).
- If no token is supplied, skip the invite check and proceed directly to user creation.
- The `affiliateInvite.update` (marking the invite used) only runs when an invite was found.
- Everything else is unchanged: email verification, rate limiting, referral code generation, default commission rate from `AFFILIATE_DEFAULT_COMMISSION`.

### `app/(store)/auth/register/RegisterForm.tsx`

Render the hidden `token` input only when a token prop is provided. When absent the form submits without it, which the action now handles correctly.

## What does not change

- Admin invite creation (`/admin/affiliates/invite`) and the `createInviteAction`
- All admin affiliate screens
- `User.status` defaults to `"active"` — self-registered affiliates are immediately active
- `commissionRate` defaults from `AFFILIATE_DEFAULT_COMMISSION` env var (same as invite path)
- Email verification flow
- Rate limiting (5 registrations per IP per minute)
- Password rules
- Referral code generation

## No DB schema changes

`AffiliateInvite` is unchanged. `User` and `AffiliateProfile` models already support this flow with their existing defaults.
