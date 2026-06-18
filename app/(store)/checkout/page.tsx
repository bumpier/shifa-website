import { Suspense } from "react";
import { getPaymentConfig } from "@/lib/payments/config";
import { CheckoutForm } from "./CheckoutForm";

// Reads payment config at request time, so it must not be statically cached.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const { methods } = getPaymentConfig();
  return (
    <Suspense>
      <CheckoutForm methods={methods} />
    </Suspense>
  );
}
