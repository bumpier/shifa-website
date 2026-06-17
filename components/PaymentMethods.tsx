/**
 * Displays accepted payment methods with icons and labels
 */

const PAYMENT_METHODS = [
  // Crypto only — all with a 10% discount
  { id: "btc", label: "Bitcoin", badge: "₿", hint: "10% off" },
  { id: "eth", label: "Ethereum", badge: "Ξ", hint: "10% off" },
  { id: "usdt", label: "USDT", badge: "💵", hint: "10% off" },
  { id: "xmr", label: "Monero", badge: "🔐", hint: "10% off, private" },
];

export function PaymentMethods() {
  return (
    <div className="mt-8 w-full rounded-xl border border-line bg-paper p-6">
      <p className="text-sm font-semibold text-ink mb-4">Accepted payment methods</p>

      {/* Crypto section */}
      <div className="rounded-lg bg-green-50 p-3 border border-green-200">
        <p className="text-xs font-semibold text-green-900 mb-2">💚 Get 10% off with crypto</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
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

      <p className="mt-3 text-[0.7rem] text-ink-soft/60">
        🔒 All payments processed securely via Heleket.
      </p>
    </div>
  );
}
