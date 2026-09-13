"use client";

/**
 * Thin typed fetch wrapper for Nexora APIs.
 * - Adds credentials + JSON headers
 * - Throws ApiClientError with a user-safe message + code
 * - Central place to map server errors to friendly copy
 */
import type { ApiEnvelope } from "@/types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

interface Options extends Omit<RequestInit, "body"> {
  body?: unknown; // serialized to JSON when not FormData/string
  /** Signal a 401 should be surfaced (default false → auto logout). */
  skipAuthRedirect?: boolean;
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { body, headers, skipAuthRedirect, ...rest } = options;
  let payload: BodyInit | undefined;
  if (body instanceof FormData || typeof body === "string") {
    payload = body as BodyInit;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(payload && !(payload instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: payload,
    credentials: "same-origin",
  });

  if (res.status === 401 && !skipAuthRedirect) {
    // Session expired — full reload intentional to drop React Query cache and ensure clean login.
    // Uses href (not assign) to satisfy Next.js lint while preserving full reload behavior.
    // Next param is validated via safeNext on the login page, preventing open redirect.
    if (typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiClientError(401, "unauthorized", "Your session has expired. Please sign in again.");
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. HTML error page from a proxy) — treat as server error.
  }

  if (!res.ok || !json || json.success !== true) {
    const err = json?.success === false ? json.error : null;
    throw new ApiClientError(
      res.status,
      err?.code ?? "server_error",
      err?.message ?? "Something went wrong. Please try again.",
      err?.fieldErrors
    );
  }
  return json.data;
}

/** Query-string builder that drops empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined | string[]>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v !== "") search.append(key, v);
    } else {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
