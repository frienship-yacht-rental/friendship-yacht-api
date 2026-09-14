import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import morgan from "morgan";
import { isProduction } from "./config/env.js";
import logger, { morganStream } from "./config/logger.js";

const app: Express = express();

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

app.use((req: Request, res: Response) => {
  logger.warn("Route not found", { method: req.method, path: req.originalUrl });
  res.status(404).json({ message: "Route not found" });
});

/** Errors thrown by express internals (body-parser, etc.) carry their own status. */
interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;

  // A malformed request is the caller's problem; keep error.log for genuine faults.
  const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(err.message, {
    status,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
  });

  // Never leak an internal stack trace to the client.
  res.status(status).json({
    message: status >= 500 ? "Internal server error" : err.message,
  });
});

export default app;
