import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const userRouter: Router = Router();

userRouter.post("/sign-up", asyncHandler(userController.signUpUser));
userRouter.post("/sign-in", asyncHandler(userController.signInUser));
userRouter.post("/sign-out", asyncHandler(userController.signOutUser));
