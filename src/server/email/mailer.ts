import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { getRuntimeConfig } from "@/server/services/platform-config.service";

/**
 * Email abstraction. Two transports:
 *  - SMTP (production) when SMTP_HOST is configured
 *  - local outbox (development): messages are appended as JSONL under
 *    ./storage/outbox — so invite/verification flows are fully testable
 *    without an email provider.
 *
 * Delivery failures are logged and swallowed: auth endpoints must keep
 * their generic responses (anti-enumeration) regardless of mail state.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;
let transporterFingerprint = "";
let warned = false;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const cfg = await getRuntimeConfig();
  const { host, port, user, pass, secure } = cfg.smtp;
  if (!host) return null;
  const fingerprint = [host, port, user ?? "", pass ? "set" : "unset", secure].join("|");
  if (!transporter || transporterFingerprint !== fingerprint) {
    transporter?.close();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    transporterFingerprint = fingerprint;
  }
  return transporter;
}

async function writeOutbox(message: MailMessage): Promise<void> {
  const dir = path.join(process.cwd(), "storage", "outbox");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "emails.jsonl");
  await fs.appendFile(file, `${JSON.stringify({ at: new Date().toISOString(), ...message })}\n`, "utf8");
}

export async function sendMail(message: MailMessage): Promise<{ delivered: boolean; transport: "smtp" | "outbox" }> {
  const smtp = await getTransporter();
  if (!smtp) {
    await writeOutbox(message);
    return { delivered: false, transport: "outbox" };
  }
  try {
    await smtp.sendMail({
      from: (await getRuntimeConfig()).smtp.mailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { delivered: true, transport: "smtp" };
  } catch (error) {
    if (!warned) {
      console.error("[mailer] SMTP send failed — falling back to outbox:", error);
      warned = true;
    }
    await writeOutbox(message).catch(() => undefined);
    return { delivered: false, transport: "outbox" };
  }
}

/** Resolves the app's public origin for email links. */
export function appLink(pathname: string): string {
  return `${env.appUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export async function outboxPath(): Promise<string> {
  return path.join(process.cwd(), "storage", "outbox", "emails.jsonl");
}
