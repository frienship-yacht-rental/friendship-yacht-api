import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { createInquirySchemas, type InquiryController } from "./controller.js";

export function createInquiryRouter(controller: InquiryController): Router {
  const router = Router();

  router.post("/", validate(createInquirySchemas), controller.create);

  return router;
}
