import "dotenv/config";
import { z } from "zod";

// Every environment variable the API reads is declared and validated here,
// once, at boot. Nothing else in the codebase touches process.env.

const csv = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(2222),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_KEY: z.string().min(1, "JWT_KEY is required"),

  // Number of reverse proxies in front of Node (Nginx = 1, Cloudflare + Nginx = 2).
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // Only true once HTTPS terminates in front of the app; Secure cookies are dropped over HTTP.
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  APP_URL: z.string().url().default("http://localhost:8080"),
  CORS_ORIGINS: csv(
    "http://localhost:8080,http://localhost:8081,http://localhost:5173,http://localhost:4173",
  ),
  // Some hosts can't resolve Atlas SRV records with the system resolver.
  // Empty string = use the system resolver.
  DNS_SERVERS: csv("8.8.8.8,1.1.1.1"),

  // Google sign-in. Both set = the "Continue with Google" button appears.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Must match an authorised redirect URI in Google Cloud. Defaults to
  // APP_URL + /api/auth/google/callback (right for the same-origin deployment).
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Project Teams <no-reply@localhost>"),

  AI_MODEL: z.string().default("gemini-2.5-flash"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  AI_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(60),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().optional(),

  // Let webhooks call private/local addresses (only for testing on your own machine).
  WEBHOOKS_ALLOW_PRIVATE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // How long audit log events are kept before they expire.
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),

  REDIS_URL: z.string().default("redis://localhost:6379"),
  // Skip background indexing jobs entirely (tests, or running without Redis).
  QUEUE_DISABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Share sockets and presence through Redis so the API can run as several
  // processes. Off = single process (PM2 instances: 1), presence in memory.
  REALTIME_REDIS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // Logger depends on config, so this one message goes straight to stderr.
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === "production";
export const isTest = config.NODE_ENV === "test";
export type Config = typeof config;
