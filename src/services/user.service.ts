import { isAPIError } from "better-auth/api";
import { auth } from "../lib/auth.js";
import { BetterAuthError } from "../lib/errors.js";
import type { IAuthService, SignInType, SignUpType } from "../schemas/user.schema.js";

export class AuthService implements IAuthService {
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
      if (isAPIError(error)) throw new BetterAuthError(error);
      throw error;
    }
  }

  async signUp({ email, password, username }: SignUpType) {
    try {
      const data = await auth.api.signUpEmail({
        body: {
          email,
          name: username,
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
      if (isAPIError(error)) throw new BetterAuthError(error);
      throw error;
    }
  }

  async signOut() {
    try {
      const data = await auth.api.signOut();

      return {
        data,
        error: null,
      };
    } catch (error) {
      if (isAPIError(error)) throw new BetterAuthError(error);
      throw error;
    }
  }
}
