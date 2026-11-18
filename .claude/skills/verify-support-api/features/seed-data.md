# Seed data

The seed gives the assistant one customer for each refund edge case, with tickets and three policies. Tests, evals and later routes refer to these rows by the fixed IDs in `SEED_IDS`.

## Sub-features

- `seed-duplicate` gives `cus_duplicate` two succeeded `4900` USD charges 2 minutes apart.
- `seed-refunded` gives `cus_refunded` a charge with status `refunded` and a refund row that points to it.
- `seed-above-limit` gives `cus_above_limit` a `120000` charge, above the refund policy limit of `50000`.
- `seed-no-duplicate` gives `cus_no_duplicate` two `4900` charges 30 days apart.
- `seed-policies` loads `refund-policy` (limit `50000`, window `30` days), `billing-faq` and `account-access`.
- `seed-tickets` gives each customer one `open` ticket.

## How to get to it (user POV)

- Run `npm run db:seed` after setup. Today no route exposes these rows. Read them with SQL.

## Driving it with verify.mjs

Preconditions:

- `$V doctor` reports `DOCTOR OK` on a fresh launch.

- **Customers.** Run `$V sql "select id, name, plan from customers order by id" --name seed-data--customers`. There are 4 rows: `cus_above_limit`, `cus_duplicate`, `cus_no_duplicate`, `cus_refunded`.
- **Duplicate charge.** Run `$V sql "select id, amount_cents, status, created_at from transactions where customer_id = 'cus_duplicate' order by created_at" --name seed-data--duplicate`. There are 2 `succeeded` rows of `4900`, and the `created_at` values are 2 minutes apart.
- **Already refunded.** Run `$V sql "select id, type, status, refunded_transaction_id from transactions where customer_id = 'cus_refunded' order by created_at" --name seed-data--refunded`. `txn_refunded_charge` has status `refunded`. `txn_refunded_refund` has type `refund` and points to `txn_refunded_charge`.
- **Above limit.** Run `$V sql "select t.amount_cents, p.max_refund_cents from transactions t, policies p where t.id = 'txn_above_limit' and p.slug = 'refund-policy'" --name seed-data--above-limit`. The row is `120000 | 50000`.
- **No duplicate.** Run `$V sql "select id, created_at from transactions where customer_id = 'cus_no_duplicate' order by created_at" --name seed-data--no-duplicate`. There are 2 rows, 30 days apart.
- **Policies and tickets.** Run `$V sql "select slug, max_refund_cents, refund_window_days from policies order by slug" --name seed-data--policies` and `$V sql "select id, customer_id, status from tickets order by id" --name seed-data--tickets`. There are 3 policies and 4 `open` tickets, one per customer.

## Gotchas

- Dates are relative to the seed time. Compare gaps between rows, not fixed dates.
- The refund window is 30 days. `txn_renewal_previous` is 35 days old, so it is outside the window on purpose.
- When a route that reads these rows ships, drive the route as the entry point and keep SQL as the second view. SQL alone then stops being enough proof.
