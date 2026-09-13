import { connectDb } from "@/server/db/db";
import { PlatformConfig } from "@/server/db/models/platform-config.model";
import { encryptSecret, decryptSecret } from "@/server/security/encryption";
import { env } from "@/lib/env";

export interface RuntimeConfig {
  admins: { emails: string[] };
  storage: { driver: "local" | "cloudinary" };
  smtp: { host: string | null; port: number; secure: boolean; user: string | null; pass: string | null; mailFrom: string };
  cloudinary: { cloudName: string | null; apiKey: string | null; apiSecret: string | null };
  ai: { provider: "none" | "openai-compatible" | "anthropic"; apiKey: string | null; baseUrl: string | null; model: string | null };
  realtime: { driver: "none" | "pusher"; appId: string | null; key: string | null; secret: string | null; cluster: string };
  platform: { name: string; supportEmail: string; maintenanceMode: boolean; allowRegistration: boolean };
}

let cache: { value: RuntimeConfig; expiresAt: number } | null = null;

function envRuntimeConfig(): RuntimeConfig {
  return {
    admins: { emails: (env.platformAdminEmails ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean) },
    storage: { driver: env.storageDriver as RuntimeConfig["storage"]["driver"] },
    smtp: { host: env.smtp.host ?? null, port: env.smtp.port, secure: env.smtp.secure, user: env.smtp.user ?? null, pass: env.smtp.pass ?? null, mailFrom: env.mailFrom },
    cloudinary: { cloudName: env.cloudinary.cloudName ?? null, apiKey: env.cloudinary.apiKey ?? null, apiSecret: env.cloudinary.apiSecret ?? null },
    ai: { provider: env.aiProvider as RuntimeConfig["ai"]["provider"], apiKey: env.aiApiKey ?? null, baseUrl: env.aiBaseUrl ?? null, model: env.aiModel ?? null },
    realtime: { driver: env.realtimeDriver as RuntimeConfig["realtime"]["driver"], appId: env.pusher.appId ?? null, key: env.pusher.key ?? null, secret: env.pusher.secret ?? null, cluster: env.pusher.cluster },
    platform: { name: env.platformName, supportEmail: env.platformEmail, maintenanceMode: false, allowRegistration: true },
  };
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  await connectDb();
  const doc = await PlatformConfig.findOne({}).lean();
  const fallback = envRuntimeConfig();
  if (!doc) {
    cache = { value: fallback, expiresAt: Date.now() + 30_000 };
    return fallback;
  }
  const value: RuntimeConfig = {
    admins: { emails: Array.from(new Set([...(fallback.admins.emails ?? []), ...(doc.admins?.emails ?? [])].map((e) => e.toLowerCase()))) },
    storage: { driver: doc.storage?.driver ?? fallback.storage.driver },
    smtp: {
      host: doc.smtp.host ?? fallback.smtp.host,
      port: doc.smtp.port || fallback.smtp.port,
      secure: doc.smtp.host ? doc.smtp.secure : fallback.smtp.secure,
      user: doc.smtp.user ?? fallback.smtp.user,
      pass: doc.smtp.passEncrypted ? decryptSecret(doc.smtp.passEncrypted) : fallback.smtp.pass,
      mailFrom: doc.smtp.mailFrom ?? fallback.smtp.mailFrom,
    },
    cloudinary: {
      cloudName: doc.cloudinary.cloudName ?? fallback.cloudinary.cloudName,
      apiKey: doc.cloudinary.apiKey ?? fallback.cloudinary.apiKey,
      apiSecret: doc.cloudinary.apiSecretEncrypted ? decryptSecret(doc.cloudinary.apiSecretEncrypted) : fallback.cloudinary.apiSecret,
    },
    ai: {
      provider: doc.ai.provider === "none" && !doc.ai.apiKeyEncrypted && !doc.ai.baseUrl ? fallback.ai.provider : doc.ai.provider,
      apiKey: doc.ai.apiKeyEncrypted ? decryptSecret(doc.ai.apiKeyEncrypted) : fallback.ai.apiKey,
      baseUrl: doc.ai.baseUrl ?? fallback.ai.baseUrl,
      model: doc.ai.model ?? fallback.ai.model,
    },
    realtime: {
      driver: doc.realtime.driver === "none" && !doc.realtime.secretEncrypted && !doc.realtime.appId ? fallback.realtime.driver : doc.realtime.driver,
      appId: doc.realtime.appId ?? fallback.realtime.appId,
      key: doc.realtime.key ?? fallback.realtime.key,
      secret: doc.realtime.secretEncrypted ? decryptSecret(doc.realtime.secretEncrypted) : fallback.realtime.secret,
      cluster: doc.realtime.cluster ?? fallback.realtime.cluster,
    },
    platform: {
      name: doc.platform.name || fallback.platform.name,
      supportEmail: doc.platform.supportEmail || fallback.platform.supportEmail,
      maintenanceMode: doc.platform.maintenanceMode,
      allowRegistration: doc.platform.allowRegistration,
    },
  };
  cache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export function clearRuntimeConfigCache(): void {
  cache = null;
}

export interface PlatformConfigInput {
  admins?: { emails?: string[] };
  storage?: { driver?: RuntimeConfig["storage"]["driver"] };
  smtp?: { host?: string; port?: number; secure?: boolean; user?: string; pass?: string; clearPass?: boolean; mailFrom?: string };
  cloudinary?: { cloudName?: string; apiKey?: string; apiSecret?: string; clearApiSecret?: boolean };
  ai?: { provider?: RuntimeConfig["ai"]["provider"]; apiKey?: string; clearApiKey?: boolean; baseUrl?: string; model?: string };
  realtime?: { driver?: RuntimeConfig["realtime"]["driver"]; appId?: string; key?: string; secret?: string; clearSecret?: boolean; cluster?: string };
  platform?: { name?: string; supportEmail?: string; maintenanceMode?: boolean; allowRegistration?: boolean };
}

function clean(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function updatePlatformConfig(input: PlatformConfigInput, actorEmail: string): Promise<void> {
  await connectDb();
  const doc = (await PlatformConfig.findOne({})) ?? new PlatformConfig({});

  if (input.admins?.emails !== undefined) {
    const emails = Array.from(new Set(input.admins.emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
    if (!emails.includes(actorEmail.toLowerCase())) throw new Error("Keep your own admin email in the platform admin list to prevent lockout.");
    doc.admins.emails = emails;
  }

  if (input.storage?.driver !== undefined) doc.storage.driver = input.storage.driver;

  if (input.smtp) {
    if (input.smtp.host !== undefined) doc.smtp.host = clean(input.smtp.host) ?? null;
    if (input.smtp.port !== undefined) doc.smtp.port = input.smtp.port;
    if (input.smtp.secure !== undefined) doc.smtp.secure = input.smtp.secure;
    if (input.smtp.user !== undefined) doc.smtp.user = clean(input.smtp.user) ?? null;
    if (input.smtp.mailFrom !== undefined) doc.smtp.mailFrom = clean(input.smtp.mailFrom) ?? null;
    if (input.smtp.clearPass) doc.smtp.passEncrypted = null;
    else if (input.smtp.pass) doc.smtp.passEncrypted = encryptSecret(input.smtp.pass);
  }
  if (input.cloudinary) {
    if (input.cloudinary.cloudName !== undefined) doc.cloudinary.cloudName = clean(input.cloudinary.cloudName) ?? null;
    if (input.cloudinary.apiKey !== undefined) doc.cloudinary.apiKey = clean(input.cloudinary.apiKey) ?? null;
    if (input.cloudinary.clearApiSecret) doc.cloudinary.apiSecretEncrypted = null;
    else if (input.cloudinary.apiSecret) doc.cloudinary.apiSecretEncrypted = encryptSecret(input.cloudinary.apiSecret);
  }
  if (input.ai) {
    if (input.ai.provider !== undefined) doc.ai.provider = input.ai.provider;
    if (input.ai.baseUrl !== undefined) doc.ai.baseUrl = clean(input.ai.baseUrl) ?? null;
    if (input.ai.model !== undefined) doc.ai.model = clean(input.ai.model) ?? null;
    if (input.ai.clearApiKey) doc.ai.apiKeyEncrypted = null;
    else if (input.ai.apiKey) doc.ai.apiKeyEncrypted = encryptSecret(input.ai.apiKey);
  }
  if (input.realtime) {
    if (input.realtime.driver !== undefined) doc.realtime.driver = input.realtime.driver;
    if (input.realtime.appId !== undefined) doc.realtime.appId = clean(input.realtime.appId) ?? null;
    if (input.realtime.key !== undefined) doc.realtime.key = clean(input.realtime.key) ?? null;
    if (input.realtime.cluster !== undefined) doc.realtime.cluster = clean(input.realtime.cluster) ?? null;
    if (input.realtime.clearSecret) doc.realtime.secretEncrypted = null;
    else if (input.realtime.secret) doc.realtime.secretEncrypted = encryptSecret(input.realtime.secret);
  }
  if (input.platform) {
    if (input.platform.name !== undefined) doc.platform.name = clean(input.platform.name) ?? "Nexora";
    if (input.platform.supportEmail !== undefined) doc.platform.supportEmail = clean(input.platform.supportEmail) ?? env.platformEmail;
    if (input.platform.maintenanceMode !== undefined) doc.platform.maintenanceMode = input.platform.maintenanceMode;
    if (input.platform.allowRegistration !== undefined) doc.platform.allowRegistration = input.platform.allowRegistration;
  }
  doc.updatedByEmail = actorEmail;
  await doc.save();
  clearRuntimeConfigCache();
}

export function maskSecret(value: string | null): string {
  if (!value) return "Not configured";
  return "••••••••";
}

export async function platformConfigStatus() {
  const cfg = await getRuntimeConfig();
  return {
    admins: { emails: cfg.admins.emails },
    storage: { driver: cfg.storage.driver, configured: cfg.storage.driver === "local" || Boolean(cfg.cloudinary.cloudName && cfg.cloudinary.apiKey && cfg.cloudinary.apiSecret) },
    smtp: { configured: Boolean(cfg.smtp.host), host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure, user: cfg.smtp.user, pass: maskSecret(cfg.smtp.pass), mailFrom: cfg.smtp.mailFrom },
    cloudinary: { configured: Boolean(cfg.cloudinary.cloudName && cfg.cloudinary.apiKey && cfg.cloudinary.apiSecret), cloudName: cfg.cloudinary.cloudName, apiKey: cfg.cloudinary.apiKey, apiSecret: maskSecret(cfg.cloudinary.apiSecret) },
    ai: { configured: cfg.ai.provider !== "none" && Boolean(cfg.ai.apiKey || cfg.ai.baseUrl), provider: cfg.ai.provider, apiKey: maskSecret(cfg.ai.apiKey), baseUrl: cfg.ai.baseUrl, model: cfg.ai.model },
    realtime: { configured: cfg.realtime.driver === "pusher" && Boolean(cfg.realtime.appId && cfg.realtime.key && cfg.realtime.secret), driver: cfg.realtime.driver, appId: cfg.realtime.appId, key: cfg.realtime.key, secret: maskSecret(cfg.realtime.secret), cluster: cfg.realtime.cluster },
    platform: cfg.platform,
  };
}

export async function testSmtpConfig() {
  const cfg = await getRuntimeConfig();
  if (!cfg.smtp.host) throw new Error("SMTP is not configured.");
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure, auth: cfg.smtp.user && cfg.smtp.pass ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined });
  await transporter.verify();
  return true;
}

export async function testAiConfig() {
  const cfg = await getRuntimeConfig();
  if (cfg.ai.provider === "none") throw new Error("AI provider is disabled.");
  if (!cfg.ai.apiKey && !cfg.ai.baseUrl) throw new Error("AI provider is not configured.");

  const message = "Reply with exactly OK.";
  if (cfg.ai.provider === "anthropic") {
    const base = cfg.ai.baseUrl ?? "https://api.anthropic.com";
    const model = cfg.ai.model ?? "claude-sonnet-4-5";
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.ai.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: message }] }),
    });
    if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}.`);
    return { provider: "anthropic", model };
  }

  const base = cfg.ai.baseUrl ?? "https://api.openai.com/v1";
  const model = cfg.ai.model;
  if (!model) throw new Error("AI model is required for an OpenAI-compatible provider.");
  const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.ai.apiKey ? { authorization: `Bearer ${cfg.ai.apiKey}` } : {}),
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: message }], max_tokens: 8, temperature: 0 }),
  });
  if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}.`);
  return { provider: "openai-compatible", model };
}

export async function testCloudinaryConfig() {
  const cfg = await getRuntimeConfig();
  if (!cfg.cloudinary.cloudName || !cfg.cloudinary.apiKey || !cfg.cloudinary.apiSecret) throw new Error("Cloudinary is not fully configured.");
  const cloudinary = (await import("cloudinary")).v2;
  cloudinary.config({ cloud_name: cfg.cloudinary.cloudName, api_key: cfg.cloudinary.apiKey, api_secret: cfg.cloudinary.apiSecret });
  await cloudinary.api.ping();
  return true;
}
