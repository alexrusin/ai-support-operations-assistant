import { createPrismaClient } from "../src/infrastructure/database/client.js";
import { seedDatabase } from "./seed-data.js";

const db = createPrismaClient();

try {
  await seedDatabase(db);
  console.log("Seed complete.");
} finally {
  await db.$disconnect();
}
