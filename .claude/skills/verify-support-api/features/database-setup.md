# Database setup

An operator sets up a new database with the committed migrations, then loads the seed data. The seed can run again: it deletes all rows and loads the same rows with new timestamps.

## Sub-features

- `db-migrate-empty` applies all migrations to an empty database.
- `db-migrate-status` reports the schema as up to date after setup.
- `db-seed` loads the seed rows and prints `The seed command has been executed.`
- `db-reseed` runs the seed again with the same row counts and newer timestamps.

## How to get to it (user POV)

- Run `npx prisma migrate deploy` and `npm run db:seed`, as the README setup says.
- Run `npm run db:reset` to drop, migrate and seed in one step.

## Driving it with verify.mjs

Preconditions:

- A fresh `$V launch`. Launch itself runs `migrate deploy` and `db seed` on an empty container and prints both results.
- Take `databaseUrl` from `$V info`. Below it is `$URL`.

- **Migrate from empty.** Read the launch output. It has `All migrations have been successfully applied.` Then run `$V sql "select migration_name, finished_at is not null as done from _prisma_migrations" --name database-setup--migrations`. Each row has `done` = `t`.
- **Migrate status.** Run `DATABASE_URL=$URL npx prisma migrate status`. The output has `Database schema is up to date!`.
- **Seed counts.** Run `$V sql "select (select count(*) from customers) c, (select count(*) from transactions) t, (select count(*) from tickets) k, (select count(*) from policies) p" --name database-setup--seed-counts`. The row is `4 | 7 | 4 | 3`.
- **Reseed.** Run `$V sql "select min(created_at) from customers" --name database-setup--before-reseed`, then `DATABASE_URL=$URL npm run db:seed`, then the same query with `--name database-setup--after-reseed`. The seed prints `The seed command has been executed.`, the counts stay `4 | 7 | 4 | 3`, and the `min` timestamp is later.
- **Reset.** Run `DATABASE_URL=$URL npm run db:reset`. It drops, migrates and seeds. The counts are `4 | 7 | 4 | 3` again.

## Gotchas

- Without `DATABASE_URL=$URL`, the npm scripts and Prisma read `.env` and change the dev database on port 5432. Always set it for the one command.
- `npm run db:migrate` is `prisma migrate dev`. It can make a new migration file and prompt. Do not use it for verification.
- `pg_isready` passes during the image's init phase over the Unix socket. Launch checks over TCP for that reason. Do not shorten that wait.
