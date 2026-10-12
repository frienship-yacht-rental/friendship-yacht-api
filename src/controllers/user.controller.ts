import type { RequestHandler, Request, Response } from "express";
import { ValidationError } from "../lib/errors.js";
import { SIGN_IN_VALIDATION, SIGN_UP_VALIDATION } from "../schemas/user.schema.js";
import { AuthService } from "../services/user.service.js";

class UserController {
  constructor(private readonly service: AuthService) {}

  // Arrow properties, not methods: the router passes these by reference, and
  // a plain method would lose `this` on the way.
  signUpUser: RequestHandler = async (req: Request, res: Response) => {
    const { data, error } = SIGN_UP_VALIDATION.safeParse(req.body);

    if (error) throw new ValidationError(error, "Sign up validation failed.");

    const { email, password, username } = data;

    const result = await this.service.signUp({ email, password, username });

    res.status(201).json({
      message: "User created successfully",
      success: true,
      data: {
        id: result.data.user.id,
      },
    });
  };

  signInUser: RequestHandler = async (req: Request, res: Response) => {
    const { data, error } = SIGN_IN_VALIDATION.safeParse(req.body);

    if (error) throw new ValidationError(error, "Sign up validation failed.");

    const { email, password } = data;

    const result = await this.service.signIn({ email, password });

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

  signOutUser: RequestHandler = async (req: Request, res: Response) => {
    await this.service.signOut();

    res.status(204).json({
      message: "User signed out successfully",
      success: true,
    });
  };
}

export const userController = new UserController(new AuthService());
