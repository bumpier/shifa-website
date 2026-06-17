# Crypto Payment Setup Guide

## Overview

Crypto payments are integrated using **Heleket**, which provides:
- Support for BTC, ETH, USDT, and **Monero (XMR)**
- Automatic payment verification via webhooks
- Simple API integration
- Fast payouts to your wallet

**Currencies Supported:**
- Bitcoin (BTC)
- Ethereum (ETH)
- USDT (Tether stablecoin)
- Monero (XMR) - **PRIVACY-FOCUSED** untraceable transactions

## Development (Local Testing)

No configuration needed for local development. The system runs in **simulator mode** automatically when `HELEKET_MERCHANT_ID` is unset:

1. Start the dev server: `npm run dev`
2. Add items to cart and proceed to checkout
3. Select a crypto payment method (BTC, ETH, USDT, or XMR)
4. Click "Pay securely" to go to the simulator page
5. Click "Simulate successful payment" or "Simulate failed payment"
6. Webhook is automatically sent and order is confirmed

The simulator signs webhooks correctly, so you can test the full flow end-to-end.

## Production Setup

### Step 1: Create Heleket Account

1. Go to https://heleket.com/
2. Sign up and verify your email
3. Complete basic account setup
4. Copy your **Merchant ID** (UUID) from your account dashboard
5. Generate a **Payment API Key** from the API settings

### Step 2: Configure Environment Variables

In your `.env.local` (or hosting platform's env vars), set:

```env
HELEKET_MERCHANT_ID=your_merchant_uuid_here
HELEKET_PAYMENT_API_KEY=your_payment_api_key_here
```

`HELEKET_MERCHANT_ID` is the merchant UUID shown in your Heleket dashboard.
`HELEKET_PAYMENT_API_KEY` is used to sign outbound API requests and to verify inbound webhook signatures.

### Step 3: Set Webhook URL in Heleket

1. In Heleket dashboard, go to your webhook/IPN settings
2. Add a new webhook URL:
   ```
   https://yourdomain.com/api/webhooks/heleket
   ```
3. Save the webhook configuration

### Step 4: Deploy

Deploy your site with the environment variables set. Crypto payments will automatically use Heleket instead of the simulator.

## How It Works

### Crypto Payment Flow

1. **Checkout page** shows crypto options with 10% discount badge
2. **User selects crypto** and amounts recalculate to show discount
3. **Checkout API**
   - Validates the order
   - Applies 10% discount automatically
   - Converts order total to USD
   - Creates a Heleket payment at `api.heleket.com/v1/payment`
4. **User redirected** to Heleket payment page
5. **User pays** with their crypto wallet
6. **Webhook notification sent** when payment is received and confirmed
7. **Webhook verified**: Heleket embeds `sign = md5(base64(json-body) + payment-key)` in the body; the handler removes `sign`, re-serialises, and recomputes to confirm authenticity
8. **Order marked as paid** in database
9. **Order confirmation** page shown to user

### Discount Logic

- **Crypto payments (BTC/ETH/USDT/XMR)**: **10% automatic discount** applied at checkout
- Discount is calculated and shown to user before payment
- Discount is applied server-side to prevent tampering

### Pricing

For crypto payments:
- Prices are converted to USD for the Heleket payment
- User sees prices in USD on checkout page
- Customer receives their 10% discount on the USD amount
- Payment received directly to your wallet

## Supported Cryptocurrencies

| Currency | Type | Status | Privacy | Notes |
|----------|------|--------|---------|-------|
| BTC | Bitcoin | ✅ Active | Pseudonymous | Most trusted, highest liquidity |
| ETH | Ethereum | ✅ Active | Pseudonymous | Fast transactions |
| USDT | Tether | ✅ Active | Pseudonymous | Stablecoin, no volatility |
| XMR | Monero | ✅ Active | **Private** | Untraceable, ring signatures |

### Why Offer Monero?

Monero (XMR) provides true financial privacy with:
- **Stealth addresses** - transactions can't be linked to public address
- **Ring signatures** - sender identity is hidden in a ring of other transactions
- **RingCT** - transaction amounts are hidden
- **100% untraceable** - unlike Bitcoin which has a transparent ledger

Perfect for customers who value privacy and financial freedom.

## Testing Payment Methods

When testing different payment scenarios:

### Test Successful Payment
1. Select crypto method
2. Go to simulator page
3. Click "Simulate successful payment"
4. Order is marked as "paid" and confirmation page shows

### Test Failed Payment
1. Select crypto method
2. Go to simulator page
3. Click "Simulate failed payment"
4. Redirected back to checkout with error message

### Test Different Cryptocurrencies
1. Select BTC, ETH, USDT, or XMR
2. Verify UI shows correct currency badge and name
3. Verify 10% discount is applied
4. Test payment flow for each currency

## Troubleshooting

### Webhook Not Being Received

Check:
1. Webhook URL is correct in Heleket dashboard: `https://yourdomain.com/api/webhooks/heleket`
2. `HELEKET_PAYMENT_API_KEY` in `.env.local` matches the key configured in Heleket exactly
3. Network connectivity from Heleket to your server
4. Server logs for webhook processing errors
5. Your firewall/WAF isn't blocking the webhook

### Payment Amount Incorrect

The amount is calculated server-side and cannot be tampered with by the client. Check:
1. Product prices are correct in database
2. 10% discount calculation: `amount * 0.9`
3. USD conversion is using correct exchange rates
4. No duplicate discounts being applied

### Simulator Not Working

The simulator only works when `HELEKET_MERCHANT_ID` is NOT set. If:
1. You have `HELEKET_MERCHANT_ID` in your env, remove it for local testing
2. You get a 404 error, check that you're accessing `/dev/heleket?invoice=...`

### Payment Confirmed But Order Not Marked as Paid

Check:
1. Webhook was actually received (check logs)
2. Signature verification succeeded (check logs for errors)
3. Order ID in webhook matches order in database
4. Database update query executed without errors

## Monitoring & Maintenance

### Regular Checks

- Monitor Heleket dashboard for failed payments
- Check server logs for webhook errors
- Monitor order status updates
- Track payment success rates

### Payment Reconciliation

```sql
-- Find orders with paid status but no confirmed crypto
SELECT * FROM "Order" 
WHERE "paymentMethod" IN ('btc', 'eth', 'usdt', 'xmr')
AND status != 'paid'
AND "createdAt" > NOW() - INTERVAL '1 day';
```

## Security Considerations

1. **Webhook Signature Verification**: Heleket signs webhooks with `sign = md5(base64(json-body) + payment-key)`, embedded in the webhook body itself (not a header). The handler removes `sign`, re-serialises the remaining fields, and recomputes to verify.
2. **Server-Side Calculations**: Discount and pricing done server-side, never trust client amounts
3. **Invoice ID Verification**: Order ID is verified in webhook before marking as paid
4. **Rate Limiting**: Checkout endpoint has rate limiting to prevent abuse
5. **HTTPS Only**: All API communication is encrypted in transit

## Advanced Configuration

### Webhook Event Handling

Current implementation processes payment confirmation events.

You can extend to handle:
- Expired payments
- Partial payments

## Support

For Heleket issues: https://heleket.com/
For API documentation: https://doc.heleket.com/
