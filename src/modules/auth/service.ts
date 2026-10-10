import { APIError } from "better-auth";
import { auth } from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";
import type { IAuthService, SignInType } from "./schema.js";

class AuthService implements IAuthService {
  async signIn({ email, password }: SignInType) {
    try {
      const data = await auth.api.signInEmail({
        body: {
          email,
          password,
          rememberMe: true,
          callbackURL: "http://localhost:8000", //TODO : Have to update this URL
        },
      });

      return {
        data,
        error: null,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw new AppError(error.body?.message ?? error.message, {
          status: error.statusCode,
          code: error.body?.code ?? "AUTH_ERROR",
          cause: error,
        });
      }
      throw error;
    }
  }
}

export const authService = new AuthService();
