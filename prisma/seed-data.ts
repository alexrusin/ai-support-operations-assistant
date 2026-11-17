// Fixed seed data. Tests and evals refer to these IDs, so do not change them.
// Dates are relative to the seed time, so the 30-day refund window stays valid.
import type { Database } from "../src/infrastructure/database/client.js";

export const SEED_IDS = {
  policies: {
    refund: "pol_refund",
    billingFaq: "pol_billing_faq",
    accountAccess: "pol_account_access",
  },
  // Real duplicate charge: two identical charges 2 minutes apart.
  duplicateCharge: {
    customer: "cus_duplicate",
    firstCharge: "txn_duplicate_1",
    secondCharge: "txn_duplicate_2",
    ticket: "tkt_duplicate",
  },
  // The charge has a refund already.
  alreadyRefunded: {
    customer: "cus_refunded",
    charge: "txn_refunded_charge",
    refund: "txn_refunded_refund",
    ticket: "tkt_refunded",
  },
  // The charge is above the policy maxRefundCents.
  aboveLimit: {
    customer: "cus_above_limit",
    charge: "txn_above_limit",
    ticket: "tkt_above_limit",
  },
  // Two normal monthly renewals. The customer thinks it is a duplicate.
  noDuplicate: {
    customer: "cus_no_duplicate",
    previousRenewal: "txn_renewal_previous",
    currentRenewal: "txn_renewal_current",
    ticket: "tkt_no_duplicate",
  },
} as const;

export const REFUND_LIMIT_CENTS = 50_000;
const MONTHLY_PRO_CENTS = 4_900;

function daysAgo(days: number, minutes = 0): Date {
  return new Date(Date.now() - days * 86_400_000 + minutes * 60_000);
}

const ids = SEED_IDS;

const policies = [
  {
    id: ids.policies.refund,
    slug: "refund-policy",
    title: "Refund policy",
    category: "billing",
    maxRefundCents: REFUND_LIMIT_CENTS,
    refundWindowDays: 30,
    body:
      "A customer can get a refund for a charge made in the last 30 days. " +
      "One refund must not be more than $500.00. A larger refund needs a manager. " +
      "A duplicate charge for the same subscription and amount is always eligible for a full refund. " +
      "A charge that is already refunded cannot be refunded again.",
  },
  {
    id: ids.policies.billingFaq,
    slug: "billing-faq",
    title: "Billing FAQ",
    category: "billing",
    body:
      "Subscriptions renew each month on the same day. Two charges one month apart are " +
      "normal renewals, not duplicate charges. A refund takes 5 to 10 business days to arrive.",
  },
  {
    id: ids.policies.accountAccess,
    slug: "account-access",
    title: "Account access policy",
    category: "security",
    body:
      "Support agents can only discuss the account that opened the ticket. " +
      "Do not share data about other accounts, even if the customer asks.",
  },
];

const customers = [
  { id: ids.duplicateCharge.customer, email: "dana@example.com", name: "Dana Kim", plan: "pro_monthly" },
  { id: ids.alreadyRefunded.customer, email: "lee@example.com", name: "Lee Novak", plan: "pro_monthly" },
  { id: ids.aboveLimit.customer, email: "sam@example.com", name: "Sam Ortiz", plan: "business_annual" },
  { id: ids.noDuplicate.customer, email: "ravi@example.com", name: "Ravi Shah", plan: "pro_monthly" },
];

const monthly = { amountCents: MONTHLY_PRO_CENTS, currency: "USD", description: "Pro plan, monthly" };

// Order matters: a refund row must come after the charge it points to.
const transactions = [
  { ...monthly, id: ids.duplicateCharge.firstCharge, customerId: ids.duplicateCharge.customer, type: "charge", status: "succeeded", externalId: "ch_sim_1001", createdAt: daysAgo(3) },
  { ...monthly, id: ids.duplicateCharge.secondCharge, customerId: ids.duplicateCharge.customer, type: "charge", status: "succeeded", externalId: "ch_sim_1002", createdAt: daysAgo(3, 2) },
  { ...monthly, id: ids.alreadyRefunded.charge, customerId: ids.alreadyRefunded.customer, type: "charge", status: "refunded", externalId: "ch_sim_2001", createdAt: daysAgo(10) },
  { ...monthly, id: ids.alreadyRefunded.refund, customerId: ids.alreadyRefunded.customer, type: "refund", status: "succeeded", externalId: "re_sim_2001", refundedTransactionId: ids.alreadyRefunded.charge, createdAt: daysAgo(8) },
  { id: ids.aboveLimit.charge, customerId: ids.aboveLimit.customer, amountCents: 120_000, currency: "USD", description: "Business plan, annual", type: "charge", status: "succeeded", externalId: "ch_sim_3001", createdAt: daysAgo(5) },
  { ...monthly, id: ids.noDuplicate.previousRenewal, customerId: ids.noDuplicate.customer, type: "charge", status: "succeeded", externalId: "ch_sim_4001", createdAt: daysAgo(35) },
  { ...monthly, id: ids.noDuplicate.currentRenewal, customerId: ids.noDuplicate.customer, type: "charge", status: "succeeded", externalId: "ch_sim_4002", createdAt: daysAgo(5) },
] as const;

const tickets = [
  { id: ids.duplicateCharge.ticket, customerId: ids.duplicateCharge.customer, subject: "Charged twice", body: "I was charged twice this month for my Pro plan. Please fix this." },
  { id: ids.alreadyRefunded.ticket, customerId: ids.alreadyRefunded.customer, subject: "Refund request", body: "I want a refund for my last Pro plan payment of $49." },
  { id: ids.aboveLimit.ticket, customerId: ids.aboveLimit.customer, subject: "Cancel and refund", body: "We do not use the product. Please refund the full $1,200 annual payment." },
  { id: ids.noDuplicate.ticket, customerId: ids.noDuplicate.customer, subject: "Double charge?", body: "I see two $49 charges on my card statement. Did you charge me twice?" },
];

// Deletes all rows, then inserts the seed data. Safe to run again.
export async function seedDatabase(db: Database): Promise<void> {
  await db.$transaction([
    db.ticket.deleteMany(),
    db.transaction.deleteMany({ where: { type: "refund" } }),
    db.transaction.deleteMany(),
    db.customer.deleteMany(),
    db.policy.deleteMany(),
    db.policy.createMany({ data: policies }),
    db.customer.createMany({ data: customers }),
    db.transaction.createMany({ data: [...transactions] }),
    db.ticket.createMany({ data: tickets }),
  ]);
}
