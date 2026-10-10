import { z } from "zod";
import type { auth } from "../../lib/auth.js";

export const SIGN_IN_VALIDATION = z.object({
  email: z.email().trim(),
  password: z
    .string()
    .min(6, "Password should be atleast 6 characters long.")
    .max(10, "Password should not be more than 10 characters.")
    .trim(),
});

export type SignInType = z.infer<typeof SIGN_IN_VALIDATION>;

type BetterAuthResponse<TData, TError> =
  { data: TData; error: null } | { data: null; error: TError };

type SignInSession = Awaited<ReturnType<typeof auth.api.signInEmail>>;
type AuthError = {
  message: string;
  status: number;
};

export interface IAuthService {
  signIn: ({
    email,
    password,
  }: SignInType) => Promise<BetterAuthResponse<SignInSession, AuthError>>;
}
