import { z } from "zod";
import type { auth } from "../../lib/auth.js";

export const SIGN_IN_VALIDATION = z.object({
  email: z.string().trim().pipe(z.email()),
  // Only non-empty: a length rule here would lock out anyone whose password
  // predates it. better-auth checks the password itself.
  password: z.string().min(1, "Password is required."),
});

export const SIGN_UP_VALIDATION = z.object({
  username: z.string().trim().min(3, "Username should be at least 3 characters long."),
  email: z.string().trim().pipe(z.email()),
  // Not trimmed: the password is stored exactly as typed. The limits must match
  // `emailAndPassword` in src/lib/auth.ts.
  password: z
    .string()
    .min(8, "Password should be at least 8 characters long.")
    .max(128, "Password should not be more than 128 characters."),
});

export type SignInType = z.infer<typeof SIGN_IN_VALIDATION>;
export type SignUpType = z.infer<typeof SIGN_UP_VALIDATION>;

/** `cookies` are the Set-Cookie values better-auth wants sent back to the browser. */
type BetterAuthResponse<TData, TError> =
  { data: TData; cookies: string[]; error: null } | { data: null; error: TError };

type SignInSession = Awaited<ReturnType<typeof auth.api.signInEmail>>;
type SignUpSession = Awaited<ReturnType<typeof auth.api.signUpEmail>>;
type SignOutSession = Awaited<ReturnType<typeof auth.api.signOut>>;

type AuthError = {
  message: string;
  status: number;
};

export interface IAuthService {
  signIn: (
    { email, password }: SignInType,
    headers: Headers,
  ) => Promise<BetterAuthResponse<SignInSession, AuthError>>;
  signUp: (
    { email, username, password }: SignUpType,
    headers: Headers,
  ) => Promise<BetterAuthResponse<SignUpSession, AuthError>>;
  signOut: (headers: Headers) => Promise<BetterAuthResponse<SignOutSession, AuthError>>;
}
