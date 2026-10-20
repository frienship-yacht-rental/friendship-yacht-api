import { isAPIError } from "better-auth/api";
import { auth } from "../lib/auth.js";
import { BetterAuthError } from "../lib/errors.js";
import type { IAuthService, SignInType, SignUpType } from "../schemas/user.schema.js";
import { env } from "../config/env.js";

export class AuthService implements IAuthService {
  async signIn({ email, password }: SignInType, headers: Headers) {
    try {
      const { response, headers: responseHeaders } = await auth.api.signInEmail({
        body: {
          email,
          password,
          rememberMe: true,
          callbackURL: env.ADMIN_URL,
        },
        headers,
        returnHeaders: true,
      });

      return {
        data: response,
        cookies: responseHeaders.getSetCookie(),
        error: null,
      };
    } catch (error) {
      if (isAPIError(error)) throw new BetterAuthError(error);
      throw error;
    }
  }

  async signUp({ email, password, username }: SignUpType, headers: Headers) {
    try {
      const { response, headers: responseHeaders } = await auth.api.signUpEmail({
        body: {
          email,
          name: username,
          password,
          rememberMe: true,
          callbackURL: env.ADMIN_URL,
        },
        headers,
        returnHeaders: true,
      });

      return {
        data: response,
        cookies: responseHeaders.getSetCookie(),
        error: null,
      };
    } catch (error) {
      if (isAPIError(error)) throw new BetterAuthError(error);
      throw error;
    }
  }

  async signOut(headers: Headers) {
    try {
      const { response, headers: responseHeaders } = await auth.api.signOut({
        headers,
        returnHeaders: true,
      });

      return {
        data: response,
        cookies: responseHeaders.getSetCookie(),
        error: null,
      };
    } catch (error) {
      if (isAPIError(error)) throw new BetterAuthError(error);
      throw error;
    }
  }
}
