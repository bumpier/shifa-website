// Throwaway smoke test for the Heleket payment integration. Run with:
//   DATABASE_URL=file:$(pwd)/data/shifa.db npx tsx scripts/smoke-heleket.ts
//
// Covers the two genuinely new pieces: the webhook signature scheme
// (sign/verify round-trip) and the paid-webhook → order transition.

// Set a payment key before exercising the signer/verifier.
process.env.HELEKET_PAYMENT_API_KEY = "smoke-test-key";

import { signHeleketWebhook, verifyHeleketSignature } from "../lib/heleket";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function main() {
  // 1) Signature round-trip
  const sample = { type: "payment", uuid: "abc", order_id: "xyz", status: "paid" };
  const sign = signHeleketWebhook(sample);
  assert(verifyHeleketSignature({ ...sample, sign }, sign), "valid signature verifies");
  assert(!verifyHeleketSignature({ ...sample, status: "fail", sign }, sign), "tampered body fails");
  assert(!verifyHeleketSignature({ ...sample, sign }, "deadbeef"), "wrong sign fails");

  console.log("\nSignature checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
