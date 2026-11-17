import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { REFUND_LIMIT_CENTS, SEED_IDS, seedDatabase } from "../../prisma/seed-data.js";
import { createPrismaClient, type Database } from "../../src/infrastructure/database/client.js";

describe("seed data", () => {
  let db: Database;

  beforeAll(async () => {
    db = createPrismaClient(inject("databaseUrl"));
    await seedDatabase(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("can run two times", async () => {
    await seedDatabase(db);
    expect(await db.customer.count()).toBe(4);
  });

  it("has a real duplicate charge", async () => {
    const { customer } = SEED_IDS.duplicateCharge;
    const charges = await db.transaction.findMany({
      where: { customerId: customer, type: "charge", status: "succeeded" },
      orderBy: { createdAt: "asc" },
    });

    expect(charges).toHaveLength(2);
    expect(charges[0]!.amountCents).toBe(charges[1]!.amountCents);
    const gapMs = charges[1]!.createdAt.getTime() - charges[0]!.createdAt.getTime();
    expect(gapMs).toBeLessThan(10 * 60_000);
  });

  it("has a charge that is already refunded", async () => {
    const { charge, refund } = SEED_IDS.alreadyRefunded;
    const original = await db.transaction.findUniqueOrThrow({
      where: { id: charge },
      include: { refunds: true },
    });

    expect(original.status).toBe("refunded");
    expect(original.refunds.map((r) => r.id)).toEqual([refund]);
  });

  it("has a charge above the refund policy limit", async () => {
    const policy = await db.policy.findUniqueOrThrow({ where: { id: SEED_IDS.policies.refund } });
    const charge = await db.transaction.findUniqueOrThrow({ where: { id: SEED_IDS.aboveLimit.charge } });

    expect(policy.maxRefundCents).toBe(REFUND_LIMIT_CENTS);
    expect(charge.amountCents).toBeGreaterThan(REFUND_LIMIT_CENTS);
  });
});
