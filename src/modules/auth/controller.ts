import type { RequestHandler, Request, Response } from "express";
import type { AuthService } from "./service.js";
import { SIGN_IN_VALIDATION, SIGN_UP_VALIDATION } from "./schema.js";
import { ValidationError } from "../../lib/errors.js";

export const authController = (service: AuthService) => {
  const signUpUser: RequestHandler = async (req: Request, res: Response) => {
    const { data, error } = SIGN_UP_VALIDATION.safeParse(req.body);

    if (error) throw new ValidationError(error, "Sign up validation failed.");

    const { email, password, username } = data;

    const result = await service.signUp({ email, password, username });

    res.status(201).json({
      message: "User created successfully",
      success: true,
      data: {
        id: result.data.user.id,
      },
    });
  };
  const signInUser: RequestHandler = async (req: Request, res: Response) => {
    const { data, error } = SIGN_IN_VALIDATION.safeParse(req.body);

    if (error) throw new ValidationError(error, "Sign up validation failed.");

    const { email, password } = data;

    const result = await service.signIn({ email, password });

    res.status(200).json({
      message: "User signed in successfully",
      success: true,
      data: {
        id: result.data.user.id,
        name: result.data.user.name,
        email: result.data.user.email,
      },
    });
  };
  const signOutUser: RequestHandler = async (req: Request, res: Response) => {
    await service.signOut();

    res.status(204).json({
      message: "User signed out successfully",
      success: true,
    });
  };

  return { signUpUser, signInUser, signOutUser };
};

export type AuthControllerType = ReturnType<typeof authController>;
