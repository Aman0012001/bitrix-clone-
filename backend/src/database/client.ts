import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

let prisma: PrismaClient | undefined;

export function getDatabaseClient(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be configured before accessing the database.");
  }

  prisma ??= new PrismaClient({
    adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }),
  });

  return prisma;
}
