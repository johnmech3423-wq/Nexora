"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api-client";

/** Show a user-safe toast for any API error; returns true when handled. */
export function handleApiError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : fallback;
  toast.error(message);
  return message;
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** True when the backend answered 402 plan_required (drives upgrade explainers). */
export function isPlanRequired(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "plan_required";
}

/** Map HTTP status codes to descriptive copy used by error states. */
export function statusHint(code: string | undefined, status: number | undefined): string | undefined {
  if (!code) return undefined;
  const map: Record<string, string> = {
    unauthorized: "Your session expired — sign in again.",
    forbidden: "You don't have permission to view this.",
    not_found: "This item no longer exists or you can't see it.",
    conflict: "There's a conflict with the current state.",
    validation_error: "Some of the values you entered are invalid.",
    plan_required: "This feature needs a paid plan.",
    rate_limited: "Too many requests — wait a moment and retry.",
  };
  return map[code] ?? (status && status >= 500 ? "The server hit a problem. Please retry shortly." : undefined);
}
