import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import {
  getYachtSchemas,
  listYachtsSchemas,
  type YachtController,
} from "./controller.js";

export function createYachtRouter(controller: YachtController): Router {
  const router = Router();

  router.get("/", validate(listYachtsSchemas), controller.list);
  router.get("/:slug", validate(getYachtSchemas), controller.getBySlug);

  return router;
}
