// Runs once per server start (Next.js instrumentation). Surfaces payment
// misconfiguration in the logs so a non-technical operator notices immediately.
export async function register() {
  const { warnMisconfiguredPayments } = await import("./lib/payments/config");
  warnMisconfiguredPayments();
}
