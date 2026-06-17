# Crypto Payments Quick Start

## TL;DR

Crypto payments (BTC, ETH, USDT, XMR) are now live with **10% discount**. No setup needed for local testing.

## For Local Development

Start the dev server—crypto works automatically (simulator mode activates when `HELEKET_MERCHANT_ID` is unset):
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

1. Go to https://heleket.com/
2. Create account → copy your **Merchant ID** (UUID) and generate a **Payment API Key**
3. Add to your deployment environment:
   ```
   HELEKET_MERCHANT_ID=your_merchant_uuid_here
   HELEKET_PAYMENT_API_KEY=your_payment_api_key_here
   ```
4. In Heleket dashboard → Add webhook URL:
   ```
   https://yourdomain.com/api/webhooks/heleket
   ```
5. Deploy and test

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
- Redirected to Heleket payment page
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
- `lib/heleket.ts` - Payment handler
- `app/api/webhooks/heleket/route.ts` - Webhook receiver
- `app/(store)/dev/heleket/page.tsx` - Dev simulator

**Updated:**
- `app/(store)/checkout/page.tsx` - UI with crypto options (now includes Monero!)
- `app/api/checkout/route.ts` - Discount + crypto logic
- `lib/validation.ts` - Added crypto payment types
- `.env.example` - Heleket config example

## Webhook Signature

Heleket embeds `sign = md5(base64(json-body) + payment-key)` directly in the webhook body (not a header). The handler removes `sign`, re-serialises the remaining fields, and recomputes to verify authenticity before marking any order paid.

## Troubleshooting

**"Simulate button not appearing"?**
→ Make sure `HELEKET_MERCHANT_ID` is empty/not set

**"10% discount not showing"?**
→ Check checkout page is using new version (should show crypto badges)

**"Payment not confirmed"?**
→ Make sure webhook URL is added to Heleket dashboard: `https://yourdomain.com/api/webhooks/heleket`

**Want more details?**
→ See `CRYPTO_SETUP.md` for full guide
