import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

export type Database = PrismaClient;

// Prisma 7 connects through a driver adapter. Here it is node-postgres (pg).
export function createPrismaClient(connectionString: string = config.DATABASE_URL): Database {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
