import type { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { UnauthorizedError } from "../lib/errors.js";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const sessionData = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!sessionData) {
    throw new UnauthorizedError();
  }

  // assigning data in the request object
  req.user = sessionData.user;
  req.session = sessionData.session;

  next();
};
