/* ------------------------------------------------------------------ */
/* Server-only environment configuration.                              */
/* Never import this module from client components — it reads secrets. */
/* Import from lib/env-public.ts when a value is safe for the browser. */
/* ------------------------------------------------------------------ */

function read(key: string): string | undefined {
  return process.env[key];
}

const requireEnv = (key: string): string => {
  const value = read(key);
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". See .env.example.`
    );
  }
  return value;
};

export const env = {
  isProd: process.env.NODE_ENV === "production",
  isDev: process.env.NODE_ENV !== "production",
  nodeEnv: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "test"
    | "production",

  appUrl: (read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),

  databaseUrl: () => requireEnv("DATABASE_URL"),
  authSecret: () => requireEnv("AUTH_SECRET"),

  /** Dev-only convenience flag to skip email verification locally. */
  autoVerify: read("AUTO_VERIFY_EMAIL") === "true",

  // --- Email ---------------------------------------------------------
  smtp: {
    host: read("SMTP_HOST"),
    port: Number(read("SMTP_PORT") ?? 587),
    secure: read("SMTP_SECURE") === "true",
    user: read("SMTP_USER"),
    pass: read("SMTP_PASS"),
  },
  mailFrom: read("MAIL_FROM") ?? "Nexora <no-reply@nexora.app>",

  // --- Storage -------------------------------------------------------
  storageDriver: read("STORAGE_DRIVER") ?? "local",
  cloudinary: {
    cloudName: read("CLOUDINARY_CLOUD_NAME"),
    apiKey: read("CLOUDINARY_API_KEY"),
    apiSecret: read("CLOUDINARY_API_SECRET"),
  },

  // --- AI ------------------------------------------------------------
  aiProvider: read("AI_PROVIDER") ?? "none",
  aiApiKey: read("AI_API_KEY"),
  aiBaseUrl: read("AI_BASE_URL"),
  aiModel: read("AI_MODEL"),
  aiDailyMemberCap: Number(read("AI_MAX_REQUESTS_PER_MEMBER_PER_DAY") ?? 30),

  // --- Realtime ------------------------------------------------------
  realtimeDriver: read("REALTIME_DRIVER") ?? "none",
  pusher: {
    appId: read("PUSHER_APP_ID"),
    key: read("PUSHER_KEY"),
    secret: read("PUSHER_SECRET"),
    cluster: read("PUSHER_CLUSTER") ?? "mt1",
  },

  // --- Billing -------------------------------------------------------
  billingProvider: read("BILLING_PROVIDER") ?? "none",
  stripe: {
    secretKey: read("STRIPE_SECRET_KEY"),
    webhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  },

  webhookSecret: () => requireEnv("WEBHOOK_SECRET"),

  /** Comma-separated emails allowed to use /admin (platform admin). */
  platformAdminEmails: read("ADMIN_EMAILS") ?? "",

  // --- OAuth ---------------------------------------------------------
  google: { clientId: read("GOOGLE_CLIENT_ID"), clientSecret: read("GOOGLE_CLIENT_SECRET") },
  github: { clientId: read("GITHUB_CLIENT_ID"), clientSecret: read("GITHUB_CLIENT_SECRET") },

  /** Public identity of the platform. */
  platformName: "Nexora",
  platformEmail: read("MAIL_FROM")?.match(/<(.+)>/)?.[1] ?? "hello@nexora.app",
} as const;

let productionConfigChecked = false;

/** Validate only immutable bootstrap settings at request time.
 * Integration secrets may be supplied securely through the platform admin
 * console and are stored encrypted in MongoDB.
 */
export function assertProductionConfig(): void {
  if (!env.isProd || productionConfigChecked) return;

  const errors: string[] = [];
  const requireValue = (name: string, value: string | undefined) => {
    if (!value) errors.push(name);
  };

  if (!env.appUrl.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_APP_URL (must use https in production)");
  }
  requireValue("DATABASE_URL", read("DATABASE_URL"));
  requireValue("AUTH_SECRET", read("AUTH_SECRET"));
  requireValue("WEBHOOK_SECRET", read("WEBHOOK_SECRET"));

  if (!["local", "cloudinary"].includes(env.storageDriver)) errors.push(`STORAGE_DRIVER (unsupported value: ${env.storageDriver})`);
  if (!["none", "pusher"].includes(env.realtimeDriver)) errors.push(`REALTIME_DRIVER (unsupported value: ${env.realtimeDriver})`);
  if (!["none", "stripe"].includes(env.billingProvider)) errors.push(`BILLING_PROVIDER (unsupported value: ${env.billingProvider})`);
  if (!["none", "openai-compatible", "anthropic"].includes(env.aiProvider)) errors.push(`AI_PROVIDER (unsupported value: ${env.aiProvider})`);

  if (errors.length) throw new Error(`Production bootstrap configuration is incomplete: ${errors.join(", ")}`);
  productionConfigChecked = true;
}
