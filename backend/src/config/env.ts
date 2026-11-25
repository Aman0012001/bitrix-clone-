import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadDotenv({ path: fileURLToPath(new URL("../../../.env.local", import.meta.url)) });
loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TOKEN_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  NEON_BRANCH: z.string().optional(),
  NEON_BRANCH_ID: z.string().optional(),
  NEON_AI_GATEWAY_BASE_URL: z.string().url().optional(),
  NEON_AI_GATEWAY_TOKEN: z.string().min(1).optional(),
  NEON_REALTIME_URL: z.string().url().optional(),
  NEON_REALTIME_SECRET: z.string().min(1).optional(),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const details = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsedEnvironment.data,
  DIRECT_URL: parsedEnvironment.data.DIRECT_URL ?? parsedEnvironment.data.DATABASE_URL_UNPOOLED,
};
