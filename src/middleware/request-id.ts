import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

declare module "express-serve-static-core" {
  interface Request {
    /** Correlation id for this request; echoed in the response and every log line. */
    id: string;
  }
}

/**
 * Accepts an upstream id (load balancer, the Next.js server) so one user
 * action can be traced across services, or mints one when absent.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
};
