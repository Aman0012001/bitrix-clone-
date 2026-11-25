import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

loadDotenv({ path: fileURLToPath(new URL("../.env.local", import.meta.url)) });
loadDotenv({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
