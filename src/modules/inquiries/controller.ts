import type { RequestHandler } from "express";
import { validated } from "../../middleware/validate.js";
import { createInquirySchema } from "./schema.js";
import type { InquiryService } from "./service.js";

export const createInquirySchemas = { body: createInquirySchema };

export function createInquiryController(service: InquiryService) {
  const create: RequestHandler = async (req, res) => {
    const { body } = validated(req, createInquirySchemas);
    res.status(201).json(await service.create(body));
  };

  return { create };
}

export type InquiryController = ReturnType<typeof createInquiryController>;
