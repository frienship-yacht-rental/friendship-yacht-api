import { Router } from "express";
import { authController } from "./auth.controller.js";

export const authRouter: Router = Router();

authRouter.post("/sign-up", authController.signUpUser);
authRouter.post("/sign-in", authController.signInUser);
authRouter.post("/sign-out", authController.signOutUser);
