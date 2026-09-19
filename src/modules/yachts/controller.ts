import type { RequestHandler } from "express";
import { validated } from "../../middleware/validate.js";
import { listYachtsQuerySchema, yachtSlugParamsSchema } from "./schema.js";
import type { YachtService } from "./service.js";

export const listYachtsSchemas = { query: listYachtsQuerySchema };
export const getYachtSchemas = { params: yachtSlugParamsSchema };

/**
 * Controllers are thin: read validated input, call the service, write the
 * response. Express 5 forwards a rejected promise to the error handler, so
 * there is no try/catch.
 */
export function createYachtController(service: YachtService) {
  const list: RequestHandler = async (req, res) => {
    const { query } = validated(req, listYachtsSchemas);
    res.json(await service.list(query));
  };

  const getBySlug: RequestHandler = async (req, res) => {
    const { params } = validated(req, getYachtSchemas);
    res.json(await service.getBySlug(params.slug));
  };

  return { list, getBySlug };
}

export type YachtController = ReturnType<typeof createYachtController>;
