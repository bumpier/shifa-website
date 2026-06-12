# Crypto Payments Quick Start

## TL;DR

Crypto payments (BTC, ETH, USDT, XMR) are now live with **10% discount**. No setup needed for local testing.

## For Local Development

Start the dev server—crypto works automatically:
```bash
npm run dev
```

1. Add items to cart
2. Checkout → Select BTC/ETH/USDT/XMR
3. See 10% discount applied
4. Click "Pay securely"
5. Simulator page appears → Click "Simulate successful payment"
6. Order confirmed ✅

## For Production

1. Go to https://nowpayments.io/
2. Create account → Settings → API Keys
3. Copy API key and IPN Secret
4. Add to your deployment environment:
   ```
   NOWPAYMENTS_API_KEY=your_key_here
   NOWPAYMENTS_IPN_SECRET=your_secret_here
   ```
5. In NOWPayments dashboard → Add IPN webhook URL:
   ```
   https://yourdomain.com/api/webhooks/nowpayments
   ```
6. Deploy and test

## What's New

**Payment Methods Added:**
- ₿ Bitcoin (BTC)
- Ξ Ethereum (ETH)
- 💵 USDT (Tether)
- 🔐 Monero (XMR) — **PRIVACY-FOCUSED!**

**10% Discount Applied Automatically**
- Shows on checkout page
- Server-side calculation (can't be hacked)
- Applies to order total in USD

**Payment Flow:**
- User selects crypto → Sees discount → Clicks Pay
- Redirected to NOWPayments payment page
- Crypto received → Order marked paid
- User sees confirmation

## Supported Currencies

| Coin | Status | Notes |
|------|--------|-------|
| BTC | ✅ Live | Bitcoin |
| ETH | ✅ Live | Ethereum |
| USDT | ✅ Live | Stablecoin (lowest volatility) |
| XMR | ✅ Live | Monero (private, untraceable) |

## Testing Checklist

- [ ] Can see crypto options in checkout (including Monero!)
- [ ] 10% discount shows correctly
- [ ] Can simulate payment in dev mode
- [ ] Order marked as paid after success
- [ ] Can go through full flow for BTC, ETH, USDT, XMR
- [ ] Discount math is correct (e.g., $100 → $90)

## Files Changed

**Created:**
- `lib/nowpayments.ts` - Payment handler
- `app/api/webhooks/nowpayments/route.ts` - Webhook receiver
- `app/(store)/dev/nowpayments/page.tsx` - Dev simulator

**Updated:**
- `app/(store)/checkout/page.tsx` - UI with crypto options (now includes Monero!)
- `app/api/checkout/route.ts` - Discount + crypto logic
- `lib/validation.ts` - Added crypto payment types
- `.env.example` - NOWPayments config example

## Why NOWPayments?

- **More coins** - Supports 200+ cryptocurrencies including Monero
- **Better privacy** - No KYC for getting started
- **Lower fees** - 0.5% to 2% depending on plan
- **Easy integration** - Simple API and webhooks
- **Instant payouts** - Direct to your wallet

## Troubleshooting

**"Simulate button not appearing"?**
→ Make sure `NOWPAYMENTS_API_KEY` is empty/not set

**"10% discount not showing"?**
→ Check checkout page is using new version (should show crypto badges)

**"Payment not confirmed"?**
→ Make sure IPN webhook URL is added to NOWPayments dashboard

**Want more details?**
→ See `CRYPTO_SETUP.md` for full guide
