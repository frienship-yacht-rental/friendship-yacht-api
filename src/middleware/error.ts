import type { NextFunction, Request, RequestHandler, Response } from "express";
import logger from "../config/logger.js";
import { isAppError } from "../lib/errors.js";

/**
 * Errors thrown by express internals (body-parser, etc.) carry their own
 * status. Application code should throw `AppError` subclasses instead.
 */
export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/**
 * Wire format for every non-2xx response. `code` is stable and intended for
 * clients; `message` is for humans and may change; `details` is optional
 * structured, client-safe information such as validation issues.
 */
export interface ErrorBody {
  message: string;
  code: string;
  details?: unknown;
  requestId: string;
}

const codeByStatus: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR",
  429: "TOO_MANY_REQUESTS",
};

export function codeForStatus(status: number): string {
  if (status >= 500) return "INTERNAL_ERROR";
  return codeByStatus[status] ?? "CLIENT_ERROR";
}

export const notFoundHandler: RequestHandler = (req, res) => {
  logger.warn("Route not found", {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
  });
  const body: ErrorBody = {
    message: "Route not found",
    code: "NOT_FOUND",
    requestId: req.id,
  };
  res.status(404).json(body);
};

// Express identifies an error handler by its arity, so `_next` must stay.
export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status ?? err.statusCode ?? 500;
  const isServerError = status >= 500;
  const appError = isAppError(err) ? err : undefined;

  // A malformed request is the caller's problem; keep error.log for genuine faults.
  const log = isServerError ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(err.message, {
    requestId: req.id,
    status,
    code: err.code,
    stack: isServerError ? err.stack : undefined,
    cause: err.cause,
    method: req.method,
    path: req.originalUrl,
  });

  // Never leak an internal message, stack trace or details to the client.
  const body: ErrorBody = {
    message: isServerError ? "Internal server error" : err.message,
    code: isServerError ? "INTERNAL_ERROR" : (err.code ?? codeForStatus(status)),
    requestId: req.id,
  };
  if (!isServerError && appError?.details !== undefined) {
    body.details = appError.details;
  }

  res.status(status).json(body);
}
