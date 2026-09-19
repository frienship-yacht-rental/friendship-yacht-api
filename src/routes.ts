import { Router } from "express";
import { inquiryRouter } from "./modules/inquiries/index.js";
import { yachtRouter } from "./modules/yachts/index.js";

/**
 * Versioned API surface. Breaking changes get a new prefix; `/health` stays
 * unversioned because infrastructure probes must not care about API versions.
 */
export function createApiRouter(): Router {
  const api = Router();

  api.use("/yachts", yachtRouter);
  api.use("/inquiries", inquiryRouter);

  return api;
}

export const API_PREFIX = "/api/v1";
