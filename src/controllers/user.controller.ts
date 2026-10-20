import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler, Request, Response } from "express";
import { ValidationError } from "../lib/errors.js";
import type { ApiResponse } from "../schemas/apiResponse.schema.js";
import { SIGN_IN_VALIDATION, SIGN_UP_VALIDATION } from "../schemas/user.schema.js";
import { AuthService } from "../services/user.service.js";

class UserController {
  constructor(private readonly service: AuthService) {}

  signUpUser: RequestHandler = async (
    req: Request,
    res: Response<ApiResponse<{ id: string }>>,
  ) => {
    const { data, error } = SIGN_UP_VALIDATION.safeParse(req.body);

    if (error) throw new ValidationError(error, "Sign up validation failed.");

    const { email, password, username } = data;

    const result = await this.service.signUp(
      { email, password, username },
      fromNodeHeaders(req.headers),
    );

    res.setHeader("Set-Cookie", result.cookies);
    res.status(201).json({
      message: "User created successfully",
      success: true,
      data: {
        id: result.data.user.id,
      },
    });
  };

  signInUser: RequestHandler = async (
    req: Request,
    res: Response<ApiResponse<{ id: string; name: string; email: string }>>,
  ) => {
    const { data, error } = SIGN_IN_VALIDATION.safeParse(req.body);

    if (error) throw new ValidationError(error, "Sign in validation failed.");

    const { email, password } = data;

    const result = await this.service.signIn(
      { email, password },
      fromNodeHeaders(req.headers),
    );

    res.setHeader("Set-Cookie", result.cookies);
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

  signOutUser: RequestHandler = async (
    req: Request,
    res: Response<ApiResponse<null>>,
  ) => {
    const result = await this.service.signOut(fromNodeHeaders(req.headers));

    res.setHeader("Set-Cookie", result.cookies);
    res.status(204).end();
  };
}

export const userController = new UserController(new AuthService());
