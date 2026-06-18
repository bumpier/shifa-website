# Accepting Payments — Setup Guide

Your store can accept **card payments** (via Stripe) and **crypto payments**
(via Heleket). You can switch either one on or off independently. This guide
walks you through it step by step — no coding required.

Everything is controlled by a small text file called `.env.local` in the project
folder. Copy `.env.example` to `.env.local` first if you haven't already, then
edit the values described below. After any change, **restart the site** for it to
take effect.

---

## 1. Decide what you want to accept

| You want… | Do this |
|---|---|
| Cards only | Turn Stripe **on**, crypto **off** |
| Crypto only | Turn crypto **on**, Stripe **off** (this is the default) |
| Both | Turn **both on** |

---

## 2. Turn on card payments (Stripe)

1. Create a free account at https://stripe.com and log in.
2. In the Stripe Dashboard, go to **Developers → API keys** and copy your
   **Secret key** (it starts with `sk_live_...`, or `sk_test_...` while testing).
3. In the Stripe Dashboard, go to **Developers → Webhooks → Add endpoint**:
   - **Endpoint URL:** `https://YOUR-DOMAIN/api/webhooks/stripe`
     (replace `YOUR-DOMAIN` with your real website address)
   - **Events to send:** choose **`checkout.session.completed`**
   - Click **Add endpoint**, then copy the **Signing secret** (starts with `whsec_...`).
4. In `.env.local`, set:
   ```
   STRIPE_ENABLED=true
   STRIPE_SECRET_KEY=sk_live_...      # the Secret key from step 2
   STRIPE_WEBHOOK_SECRET=whsec_...    # the Signing secret from step 3
   ```
5. **Restart the site.**

> Both keys are required. If `STRIPE_ENABLED=true` but a key is missing, cards stay
> switched off and a warning appears in the site's logs telling you what's missing.

---

## 3. Turn on crypto payments (Heleket)

1. Log in to your Heleket merchant dashboard.
2. Copy your **Merchant UUID** and your **Payment API key**.
3. In Heleket, set your webhook / callback URL to
   `https://YOUR-DOMAIN/api/webhooks/heleket`.
4. In `.env.local`, set:
   ```
   CRYPTO_ENABLED=true
   HELEKET_MERCHANT_ID=...            # your Merchant UUID
   HELEKET_PAYMENT_API_KEY=...        # your Payment API key
   ```
5. **Restart the site.**

To **turn crypto off**, set `CRYPTO_ENABLED=false` and restart.

---

## 4. Test before going live

**Cards (Stripe test mode):** use your `sk_test_...` key, go through checkout, and
pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.

**Crypto (Heleket):** place a test order and complete the payment.

After paying, open the **admin panel → Orders**. The order should show **paid**,
and the confirmation email should arrive. When everything works, swap the Stripe
test key for the live `sk_live_...` key (and re-copy the live webhook signing
secret), then restart.

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| The "Card" option doesn't appear at checkout | Check `STRIPE_ENABLED=true` and that **both** Stripe keys are filled in, then restart. |
| The crypto options don't appear | Check `CRYPTO_ENABLED` is not `false` and `HELEKET_MERCHANT_ID` is filled in, then restart. |
| Customer paid but the order is still "pending" | The webhook isn't reaching the site. Re-check the webhook URL (step 2.3 / 3.3) and that the signing secret matches. |
| Logs say "ENABLED=true but … missing" | A required key is blank. Fill it in and restart. |

---

## 6. Every payment setting (reference)

| Variable | What it does |
|---|---|
| `STRIPE_ENABLED` | `true` to accept cards, `false`/blank to hide them. |
| `STRIPE_SECRET_KEY` | Your Stripe Secret key (`sk_live_...`/`sk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of your Stripe webhook endpoint (`whsec_...`). |
| `CRYPTO_ENABLED` | `true`/blank to accept crypto, `false` to hide it. |
| `HELEKET_MERCHANT_ID` | Your Heleket Merchant UUID. |
| `HELEKET_PAYMENT_API_KEY` | Your Heleket Payment API key. |
| `NEXT_PUBLIC_SITE_URL` | Your site's address — used to build the webhook callback links. |
