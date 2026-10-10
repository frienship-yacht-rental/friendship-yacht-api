import { Router } from "express";
import type { AuthControllerType } from "./controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export function authRouter(controller: AuthControllerType): Router {
  const router = Router();
  router.post("/sign-up", asyncHandler(controller.signUpUser));
  router.post("/sign-in", asyncHandler(controller.signInUser));
  router.post("/sign-out", asyncHandler(controller.signOutUser));

  return router;
}
