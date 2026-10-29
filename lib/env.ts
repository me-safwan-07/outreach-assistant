import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APIFY_TOKEN: z.string().optional().default(""),
  APIFY_COMPANY_ACTOR_ID: z.string().default("harvestapi/linkedin-company"),
  APIFY_EMPLOYEES_ACTOR_ID: z
    .string()
    .default("harvestapi/linkedin-company-employees"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  HUNTER_API_KEY: z.string().optional().default(""),
  FINDYMAIL_API_KEY: z.string().optional().default(""),
  PROSPEO_API_KEY: z.string().optional().default(""),
  TOMBA_API_KEY: z.string().optional().default(""),
  TOMBA_API_SECRET: z.string().optional().default(""),
  EMAIL_PROVIDER: z
    .enum(["findymail", "prospeo", "tomba", "hunter", "auto"])
    .default("auto"),
  MOCK_MODE: z
    .string()
    .transform((v) => v === "true")
    .pipe(z.boolean())
    .default(false),
  MAX_EMPLOYEES_SCRAPE: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number())
    .default(50),
  TOP_N: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number())
    .default(10),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Validate and export the parsed env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:");
  console.error(_env.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. See console for details.");
}

export const env = _env.data;
export type Env = typeof env;
