import { Router } from "express";
import { userController } from "../controllers/user.controller.js";

export const userRouter: Router = Router();

userRouter.post("/sign-up", userController.signUpUser);
userRouter.post("/sign-in", userController.signInUser);
userRouter.post("/sign-out", userController.signOutUser);
