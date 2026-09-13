/* ------------------------------------------------------------------ */
/* Nexora internal error hierarchy                                     */
/* Every thrown ApiError maps 1:1 to an HTTP response (see api.ts).    */
/* ------------------------------------------------------------------ */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(opts: {
    status?: number;
    code?: string;
    message: string;
    details?: unknown;
    /** true → message is safe to show to end users */
    expose?: boolean;
    fieldErrors?: Record<string, string[]>;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status ?? 500;
    this.code = opts.code ?? "server_error";
    this.details = opts.details;
    this.expose = opts.expose ?? this.status < 500;
    this.fieldErrors = opts.fieldErrors;
  }

  static badRequest(message: string, fieldErrors?: Record<string, string[]>) {
    return new ApiError({ status: 400, code: "validation_error", message, fieldErrors, expose: true });
  }
  static validation(fieldErrors: Record<string, string[]>) {
    return new ApiError({
      status: 422,
      code: "validation_error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
      expose: true,
    });
  }
  static unauthorized(message = "You must be signed in to do that.") {
    return new ApiError({ status: 401, code: "unauthorized", message, expose: true });
  }
  static forbidden(message = "You don't have permission to do that.") {
    return new ApiError({ status: 403, code: "forbidden", message, expose: true });
  }
  static notFound(message = "That resource does not exist or has been removed.") {
    return new ApiError({ status: 404, code: "not_found", message, expose: true });
  }
  static conflict(message: string) {
    return new ApiError({ status: 409, code: "conflict", message, expose: true });
  }
  static unprocessable(message: string) {
    return new ApiError({ status: 422, code: "unprocessable", message, expose: true });
  }
  static rateLimited(message = "Too many attempts. Please slow down and try again in a few minutes.") {
    return new ApiError({ status: 429, code: "rate_limited", message, expose: true });
  }
  static planRequired(message: string) {
    return new ApiError({ status: 402, code: "plan_required", message, expose: true });
  }
  static external(message = "A third-party service is temporarily unavailable. Please try again shortly.") {
    return new ApiError({ status: 503, code: "external_unavailable", message, expose: true });
  }
  static internal(message = "Something went wrong on our side. Please try again.") {
    return new ApiError({ status: 500, code: "server_error", message });
  }
}

/** 404 that doesn't reveal whether the resource exists (anti-enumeration). */
export function notFoundOrUnauthorized(): never {
  throw new ApiError({
    status: 404,
    code: "not_found",
    message: "That resource does not exist or you don't have access to it.",
    expose: true,
  });
}

/** Convert any thrown value into an ApiError (never leaks internals). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (process.env.NODE_ENV === "development") {
      return ApiError.internal(error.message);
    }
    // Log via console; dev mode keeps message useful locally.
  }
  return ApiError.internal();
}
