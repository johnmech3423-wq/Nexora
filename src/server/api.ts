import { NextResponse, type NextRequest } from "next/server";
import type { ApiErrorBody } from "@/types";
import { ApiError } from "@/server/errors";
import type { ZodTypeAny, ZodIssue } from "zod";

export type { NextRequest };

/** Uniform success envelope: { success: true, data } */
export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }): NextResponse {
  return NextResponse.json({ success: true, data } satisfies { success: true; data: T }, init);
}

/** Uniform error envelope: { success: false, error: { code, message, … } } */
export function fail(error: ApiError): NextResponse {
  const body: ApiErrorBody = {
    code: error.code,
    message: error.expose ? error.message : "Something went wrong on our side. Please try again.",
  };
  if (error.fieldErrors) body.fieldErrors = error.fieldErrors;
  if (process.env.NODE_ENV !== "production" && !error.expose && error.message) {
    body.details = { internal: error.message };
  }
  return NextResponse.json({ success: false, error: body }, { status: error.status });
}

/**
 * Route-handler wrapper: connects the DB, executes the handler, and
 * converts every thrown error into the uniform error envelope. Never
 * lets raw stack traces reach clients.
 */
export function handleApi<Ctx>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse>
): (req: NextRequest, ctx: Ctx) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) return fail(error);
      if (process.env.NODE_ENV !== "production") {
        console.error("[api]", error);
        return fail(ApiError.internal(error instanceof Error ? error.message : undefined));
      }
      console.error("[api] unhandled error:", error);
      return fail(ApiError.internal());
    }
  };
}

/** Wrap handlers that never need DB connection/cookies (pure utils). */
export const handleSimple = handleApi;

/* ------------------------------------------------------------------ */
/* Zod helpers                                                         */
/* ------------------------------------------------------------------ */

/** Parse JSON body against a schema; throws a friendly 422 ApiError. */
export async function parseBody<Z extends ZodTypeAny>(req: NextRequest, schema: Z): Promise<Z["_output"]> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON.");
  }
  return validate(raw, schema);
}

/** Validate unknown value against schema (shared by GET params, body…). */
export function validate<Z extends ZodTypeAny>(value: unknown, schema: Z): Z["_output"] {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors = groupIssues(result.error.issues);
    throw ApiError.validation(fieldErrors);
  }
  return result.data;
}

/** e.g. "/api/orgs/:orgId" style param extraction helper */
export function param(ctx: Record<string, string | string[] | undefined>, key: string): string {
  const value = ctx[key];
  const s = Array.isArray(value) ? value[0] : value;
  if (!s) throw ApiError.badRequest(`Missing URL parameter "${key}".`);
  return s;
}

export function groupIssues(issues: ZodIssue[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.length ? issue.path.join(".") : "_root";
    (grouped[path] ??= []).push(issue.message);
  }
  return grouped;
}
