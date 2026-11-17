// Prisma 7 does not load .env by itself.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` does not connect, so it must work without a URL
  // (npm install in CI, or before .env exists). Migrate and seed need it.
  ...(url ? { datasource: { url } } : {}),
});
