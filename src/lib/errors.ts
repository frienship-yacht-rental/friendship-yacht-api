/**
 * Application errors carry everything the error handler needs to build a
 * response, so route code never touches `res.status()` for failures — it
 * throws, and Express 5 forwards the rejection.
 *
 * `details` is for structured, client-safe information such as field-level
 * validation issues. Never put internal state in it.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    message: string,
    options: { status: number; code: string; details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, { status: 400, code: "BAD_REQUEST", details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, { status: 401, code: "UNAUTHORIZED" });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, { status: 403, code: "FORBIDDEN" });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, { status: 404, code: "NOT_FOUND" });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(message, { status: 409, code });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, try again later") {
    super(message, { status: 429, code: "TOO_MANY_REQUESTS" });
  }
}

/** Input failed schema validation. `details` is the flattened issue list. */
export class ValidationError extends AppError {
  constructor(details: unknown, message = "Validation failed") {
    super(message, { status: 422, code: "VALIDATION_ERROR", details });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
