/**
 * Displays accepted payment methods with icons and labels
 */

const PAYMENT_METHODS = [
  // Crypto only
  { id: "btc", label: "Bitcoin", badge: "₿", hint: "" },
  { id: "eth", label: "Ethereum", badge: "Ξ", hint: "" },
  { id: "usdt", label: "USDT", badge: "💵", hint: "" },
  { id: "xmr", label: "Monero", badge: "🔐", hint: "private" },
];

export function PaymentMethods() {
  return (
    <div className="mt-8 w-full rounded-xl border border-line bg-paper p-6">
      <p className="text-sm font-semibold text-ink mb-4">Accepted payment methods</p>

      {/* Crypto section */}
      <div className="rounded-lg bg-brand-tint p-3 border border-line">
        <p className="text-xs font-semibold text-ink mb-2">Pay securely with crypto</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <div
              key={method.id}
              className="flex items-center gap-2 rounded border border-line bg-white px-2 py-1.5 text-xs"
            >
              <span className="text-base">{method.badge}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink text-[0.7rem]">{method.label}</div>
                {method.hint && (
                  <div className="text-ink-soft text-[0.6rem] font-medium">{method.hint}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[0.7rem] text-ink-soft/60">
        🔒 All crypto payments are processed securely.
      </p>
    </div>
  );
}
