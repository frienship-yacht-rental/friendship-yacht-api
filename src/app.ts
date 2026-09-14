import cors from "cors";
import express from "express";
import type { Express, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProduction } from "./config/env.js";
import { morganStream } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const app: Express = express();

// Security headers first, so they apply to every response including errors.
app.use(helmet());

// Only listed browser origins may call this API. Server-to-server callers
// (the Next.js server) are not subject to CORS.
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Access logs go through winston so they land in logs/ alongside everything else.
app.use(
  morgan(isProduction ? "combined" : "dev", {
    stream: morganStream,
  }),
);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Server status OK",
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
