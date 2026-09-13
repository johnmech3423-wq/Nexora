import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Relative time, e.g. "3h ago" / "in 2d". */
export function timeAgo(date: Date | string | number, now = Date.now()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const diffMs = now - d.getTime();
  const abs = Math.abs(diffMs);
  const future = diffMs < 0;
  const s = Math.max(1, Math.floor(abs / 1000));
  if (s < 60) return future ? "in a moment" : "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return fmt(m, "min");
  const h = Math.floor(m / 60);
  if (h < 24) return fmt(h, "hour");
  const days = Math.floor(h / 24);
  if (days < 30) return fmt(days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return fmt(months, "month");
  return fmt(Math.floor(months / 12), "year");

  function fmt(n: number, unit: string) {
    const base = `${n} ${unit}${n === 1 ? "" : "s"}`;
    return future ? `in ${base}` : `${base} ago`;
  }
}

const dateFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Sep 9, 2026" */
export function formatDate(input: Date | string | number): string {
  return dateFmt.format(new Date(input));
}

const dateTimeFmt = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(input: Date | string | number): string {
  return dateTimeFmt.format(new Date(input));
}

const timeFmt = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });
export function formatTime(input: Date | string | number): string {
  return timeFmt.format(new Date(input));
}

/** "5d left" / "2d overdue" / "Today" */
export function dueLabel(due: Date | string, now = Date.now()): { label: string; overdue: boolean; urgent: boolean } {
  const d = new Date(due).getTime();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday.getTime() - d) / 86_400_000);
  if (days === 0) return { label: "Today", overdue: false, urgent: true };
  if (days === -1) return { label: "Tomorrow", overdue: false, urgent: true };
  if (days < 0) return { label: `in ${Math.abs(days)}d`, overdue: false, urgent: false };
  if (days === 1) return { label: "1d overdue", overdue: true, urgent: true };
  return { label: `${days}d overdue`, overdue: true, urgent: days <= 3 };
}

/** Human duration from milliseconds: "1h 24m" / "45m" / "2h". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "1.2 MB", "48 KB" … */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** "AR" from "Ava Reyes" / "av" from "avery" */
export function initials(name: string | null | undefined): string {
  const clean = (name ?? "?").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Stable deterministic hash → hue, for avatar/fallback colors. */
export function hashHue(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Shorten long text with ellipsis. */
export function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** Parse a positive integer query param with a fallback. */
/** ISO date (yyyy-mm-dd) for native <input type="date"> values. */
export function dateToInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parsePositiveInt(raw: unknown, fallback: number, max = 5000): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Unique-ish id for ephemeral client keys (NOT persisted data). */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value);
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
