import type { NextRequest } from "next/server";

/** Best-effort client IP (Vercel sets x-forwarded-for at the proxy). */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

export function clientUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent")?.slice(0, 512) ?? "";
}

/** Origin check used by public endpoints (e.g. webhook receivers). */
export function assertSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser client (curl, fetch from server)
  try {
    return new URL(origin).origin === new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
  } catch {
    return false;
  }
}
