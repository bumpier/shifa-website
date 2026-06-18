/**
 * Displays accepted payment methods with icons and labels.
 * Optional `methods` prop gates which sections show; defaults to all so existing
 * call sites keep working. Pass getPaymentConfig().methods for an accurate display.
 */
import type { PaymentMethodId } from "@/lib/payments/config";

const COINS = [
  { id: "btc", label: "Bitcoin", badge: "₿", hint: "" },
  { id: "eth", label: "Ethereum", badge: "Ξ", hint: "" },
  { id: "usdt", label: "USDT", badge: "💵", hint: "" },
  { id: "xmr", label: "Monero", badge: "🔐", hint: "private" },
] as const;

const ALL: PaymentMethodId[] = ["card", "btc", "eth", "usdt", "xmr"];

export function PaymentMethods({ methods = ALL }: { methods?: PaymentMethodId[] }) {
  const hasCard = methods.includes("card");
  const coins = COINS.filter((c) => methods.includes(c.id));
  if (!hasCard && coins.length === 0) return null;

  return (
    <div className="mt-8 w-full rounded-xl border border-line bg-paper p-6">
      <p className="text-sm font-semibold text-ink mb-4">Accepted payment methods</p>

      {hasCard && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs">
          <span className="text-base" aria-hidden>💳</span>
          <span className="font-semibold text-ink">Credit / Debit Card</span>
          <span className="text-ink-soft">Visa · Mastercard · Apple Pay · Google Pay</span>
        </div>
      )}

      {coins.length > 0 && (
        <div className="rounded-lg bg-brand-tint p-3 border border-line">
          <p className="text-xs font-semibold text-ink mb-2">Pay securely with crypto</p>
          <div className="grid grid-cols-2 gap-2">
            {coins.map((method) => (
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
      )}

      <p className="mt-3 text-[0.7rem] text-ink-soft/60">
        🔒 Cards processed by Stripe · crypto by Heleket.
      </p>
    </div>
  );
}
