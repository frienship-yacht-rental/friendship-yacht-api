import { authController } from "./controller.js";
import { authRouter as createAuthRouter } from "./router.js";
import { AuthService } from "./service.js";

export const authService = new AuthService();
export const authRouter = createAuthRouter(authController(authService));
