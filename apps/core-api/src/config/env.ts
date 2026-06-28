/**
 * Environment loading + validation (Zod).
 * Fails fast at boot if a required variable is missing or malformed.
 */
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORE_API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  ADMIN_WEB_ORIGIN: z.string().url().default("http://localhost:3100"),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  // AES-256-GCM key: 32 bytes, base64-encoded.
  FIELD_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded",
    }),

  // Consultation request auto-expiry sweep interval (ms). Default 5 minutes.
  CONSULTATION_EXPIRY_INTERVAL_MS: z.coerce.number().int().positive().default(300000),

  RATE_LIMIT_PUBLIC_PER_MIN: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(300),
  MAX_CONCURRENT_SESSIONS: z.coerce.number().int().positive().default(3),

  // CORS allowed origins (comma-separated). In production set to the exact Railway URLs.
  CORS_ORIGIN: z.string().default("http://localhost:3000,http://localhost:3100"),

  // Admin panel (§12): 30-min inactivity, single session, login-failure alert email.
  ADMIN_SESSION_TIMEOUT_MIN: z.coerce.number().int().positive().default(30),
  ADMIN_ALERT_EMAIL: z.string().optional().default("superadmin@lawyerly.pk"),

  RECAPTCHA_SECRET_KEY: z.string().optional().default(""),
  HIBP_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v !== "false"),

  // Chatbot LLM (direct chat-completions API — NO RAG). §9.1
  GEMINI_API_KEY: z.string().optional().default(""),

  // AI microservice (OCR + NLP). §9.2
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  // Shared secret sent as X-API-Key on all ai-service requests (C-1 fix).
  AI_SERVICE_API_KEY: z.string().min(1, "AI_SERVICE_API_KEY is required"),

  // MinIO / S3-compatible object storage (§11, §8.7).
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("lawyerly-documents"),

  EMAIL_FROM: z.string().default("Lawyerly <no-reply@lawyerly.pk>"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().optional().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_SECURE: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
