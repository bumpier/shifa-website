/**
 * Displays accepted payment methods with icons and labels
 */

const PAYMENT_METHODS = [
  // Fiat
  { id: "card", label: "Card", badge: "💳", hint: "Visa / Mastercard" },
  { id: "jazzcash", label: "JazzCash", badge: "🟠", hint: "Mobile wallet" },
  { id: "easypaisa", label: "Easypaisa", badge: "🟢", hint: "Mobile wallet" },
  // Crypto with 10% discount
  { id: "btc", label: "Bitcoin", badge: "₿", hint: "10% off", crypto: true },
  { id: "eth", label: "Ethereum", badge: "Ξ", hint: "10% off", crypto: true },
  { id: "usdt", label: "USDT", badge: "💵", hint: "10% off", crypto: true },
  { id: "xmr", label: "Monero", badge: "🔐", hint: "10% off, private", crypto: true },
];

export function PaymentMethods() {
  const fiatMethods = PAYMENT_METHODS.filter((m) => !m.crypto);
  const cryptoMethods = PAYMENT_METHODS.filter((m) => m.crypto);

  return (
    <div className="mt-8 w-full rounded-xl border border-line bg-paper p-6">
      <p className="text-sm font-semibold text-ink mb-4">Accepted payment methods</p>

      {/* Fiat payments */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {fiatMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs"
            >
              <span className="text-lg">{method.badge}</span>
              <div className="flex-1">
                <div className="font-semibold text-ink text-[0.75rem]">{method.label}</div>
                <div className="text-ink-soft/70 text-[0.65rem]">{method.hint}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Crypto section */}
        <div className="mt-4 rounded-lg bg-green-50 p-3 border border-green-200">
          <p className="text-xs font-semibold text-green-900 mb-2">💚 Get 10% off with crypto</p>
          <div className="grid grid-cols-2 gap-2">
            {cryptoMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center gap-2 rounded border border-green-200 bg-white px-2 py-1.5 text-xs"
              >
                <span className="text-base">{method.badge}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-[0.7rem]">{method.label}</div>
                  <div className="text-green-700 text-[0.6rem] font-medium">{method.hint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[0.7rem] text-ink-soft/60">
        🔒 All payments processed securely. Crypto payments via NOWPayments.
      </p>
    </div>
  );
}
