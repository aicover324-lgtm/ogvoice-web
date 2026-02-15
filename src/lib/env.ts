import { z } from "zod";

const emptyToUndefined = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? undefined : t;
};

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),

  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(20),

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: optionalUrl,
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

  // RunPod (training runner)
  RUNPOD_API_KEY: optionalString,
  RUNPOD_ENDPOINT_ID: optionalString,

  // Cover engine dispatch (RVC AI Cover pipeline)
  COVER_ENGINE_URL: optionalUrl,
  COVER_ENGINE_TOKEN: optionalString,

  TRAINING_TOTAL_EPOCH_DEFAULT: z.coerce.number().int().min(1).max(10000).default(1),
  TRAINING_BATCH_SIZE_DEFAULT: z.coerce.number().int().min(1).max(50).default(4),
  TRAINING_SAVE_EVERY_EPOCH_DEFAULT: z.coerce.number().int().min(1).max(100).default(1),
  TRAINING_WATCHDOG_QUEUE_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(86400).default(900),
  TRAINING_WATCHDOG_HARD_TIMEOUT_SECONDS: z.coerce.number().int().min(60).max(172800).default(5400),
  TRAINING_WATCHDOG_STALL_SECONDS: z.coerce.number().int().min(30).max(86400).default(300),

  UPLOAD_MAX_FILE_BYTES_FREE: z.coerce.number().int().positive().default(104857600),
  UPLOAD_MAX_FILE_BYTES_PRO: z.coerce.number().int().positive().default(524288000),
  UPLOAD_MAX_DATASET_BYTES_FREE: z.coerce.number().int().positive().default(104857600),
  UPLOAD_MAX_DATASET_BYTES_PRO: z.coerce.number().int().positive().default(104857600),

  // Image uploads (bytes)
  UPLOAD_MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(10485760),

  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_PRO_MONTHLY: optionalString,

  // Optional (recommended for production): Upstash Redis for distributed rate limiting
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  // Automatic cleanup
  PURGE_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  UPLOAD_DRAFT_RETENTION_HOURS: z.coerce.number().int().min(6).max(24 * 90).default(72),
  GENERATED_OUTPUT_KEEP_PER_VOICE: z.coerce.number().int().min(1).max(100).default(20),
  GENERATED_OUTPUT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(60),
  PURGE_CRON_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof serverSchema>;

export const env: ServerEnv = (() => {
  // Avoid accidentally bundling server secrets into the client.
  if (typeof window !== "undefined") {
    throw new Error("env is server-only");
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
})();

export function appUrl(pathname = "/") {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}
