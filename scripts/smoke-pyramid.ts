// Throwaway smoke test for the pyramid referral flow. Run with:
//   DATABASE_URL=file:<abs>/data/shifa.db npx tsx scripts/smoke-pyramid.ts
import { prisma } from "../lib/db";
import {
  approveReferral,
  countConfirmedSales,
  createReferralForPaidOrder,
  rejectReferral,
} from "../lib/affiliate";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok: ${msg}`);
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { contains: "smoke-pyramid" } },
    include: { affiliateProfile: true },
  });
  const profileIds = users.map((u) => u.affiliateProfile?.id).filter(Boolean) as string[];
  await prisma.affiliateReferral.deleteMany({ where: { affiliateId: { in: profileIds } } });
  await prisma.order.deleteMany({ where: { customerEmail: { contains: "smoke-pyramid" } } });
  // Recruits reference the master profile; clear links before deleting users
  await prisma.affiliateProfile.updateMany({
    where: { recruiterId: { in: profileIds } },
    data: { recruiterId: null },
  });
  await prisma.user.deleteMany({ where: { email: { contains: "smoke-pyramid" } } });
}

async function main() {
  await cleanup();

  // Master with an active user, recruit linked to them
  const master = await prisma.user.create({
    data: {
      email: "master.smoke-pyramid@test.local",
      name: "Smoke Master",
      passwordHash: "x",
      affiliateProfile: {
        create: { referralCode: "smokemaster", commissionRate: 10, isMaster: true, masterAt: new Date() },
      },
    },
    include: { affiliateProfile: true },
  });
  const recruit = await prisma.user.create({
    data: {
      email: "recruit.smoke-pyramid@test.local",
      name: "Smoke Recruit",
      passwordHash: "x",
      affiliateProfile: {
        create: {
          referralCode: "smokerecruit",
          commissionRate: 10,
          recruiterId: master.affiliateProfile!.id,
        },
      },
    },
    include: { affiliateProfile: true },
  });

  const order = await prisma.order.create({
    data: {
      customerName: "Smoke Customer",
      customerEmail: "customer.smoke-pyramid@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]",
      currency: "AED",
      totalAmount: 1000,
      subtotalUsd: 1000,
      paymentMethod: "card",
      refCode: "smokerecruit",
      status: "paid",
    },
  });

  // 1) Webhook path creates direct + override
  await createReferralForPaidOrder(order.id);
  await createReferralForPaidOrder(order.id); // retry must not duplicate
  const refs = await prisma.affiliateReferral.findMany({ where: { orderId: order.id } });
  assert(refs.length === 2, "one direct + one override created (retry-safe)");
  const direct = refs.find((r) => r.kind === "direct")!;
  const override = refs.find((r) => r.kind === "override")!;
  assert(direct.affiliateId === recruit.affiliateProfile!.id, "direct belongs to recruit");
  assert(override.affiliateId === master.affiliateProfile!.id, "override belongs to master");
  assert(override.parentReferralId === direct.id, "override linked to direct");
  assert(direct.commissionAmountUsdt.toString() === "100", "direct = 10% of 1000");
  assert(override.commissionAmountUsdt.toString() === "25", "override = 2.5% of 1000");

  // 2) Approving the direct cascades to the override and both balances move
  await approveReferral(direct.id);
  const masterProfile = await prisma.affiliateProfile.findUnique({
    where: { id: master.affiliateProfile!.id },
  });
  const recruitProfile = await prisma.affiliateProfile.findUnique({
    where: { id: recruit.affiliateProfile!.id },
  });
  assert(recruitProfile!.pendingBalance.toString() === "100", "recruit balance +100");
  assert(masterProfile!.pendingBalance.toString() === "25", "master balance +25");
  assert(
    (await prisma.affiliateReferral.findUnique({ where: { id: override.id } }))!.status ===
      "approved",
    "override auto-approved with direct"
  );
  assert((await countConfirmedSales(recruitProfile!.id)) === 1, "confirmed sales counts direct only");
  assert((await countConfirmedSales(masterProfile!.id)) === 0, "overrides don't count as confirmed sales");

  // 3) Rejecting the direct claws back both
  await rejectReferral(direct.id);
  const masterAfter = await prisma.affiliateProfile.findUnique({
    where: { id: master.affiliateProfile!.id },
  });
  const recruitAfter = await prisma.affiliateProfile.findUnique({
    where: { id: recruit.affiliateProfile!.id },
  });
  assert(recruitAfter!.pendingBalance.toString() === "0", "recruit clawed back to 0");
  assert(masterAfter!.pendingBalance.toString() === "0", "master clawed back to 0");

  // 4) Demoted master earns no override on new orders
  await prisma.affiliateProfile.update({
    where: { id: master.affiliateProfile!.id },
    data: { isMaster: false },
  });
  const order2 = await prisma.order.create({
    data: {
      customerName: "Smoke Customer 2",
      customerEmail: "customer2.smoke-pyramid@test.local",
      customerPhone: "+971000000000",
      shippingAddress: "{}",
      items: "[]",
      currency: "AED",
      totalAmount: 500,
      subtotalUsd: 500,
      paymentMethod: "card",
      refCode: "smokerecruit",
      status: "paid",
    },
  });
  await createReferralForPaidOrder(order2.id);
  const refs2 = await prisma.affiliateReferral.findMany({ where: { orderId: order2.id } });
  assert(refs2.length === 1 && refs2[0]!.kind === "direct", "demoted master gets no override");

  await cleanup();
  console.log("\nAll smoke checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
