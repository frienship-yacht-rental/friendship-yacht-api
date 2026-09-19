import cors from "cors";
import express from "express";
import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProduction } from "./config/env.js";
import { morganStream } from "./config/logger.js";
import { TooManyRequestsError } from "./lib/errors.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { requestId } from "./middleware/request-id.js";
import { API_PREFIX, createApiRouter } from "./routes.js";

const app: Express = express();

// Needed for req.ip and rate limiting to see the real client behind a proxy.
app.set("trust proxy", env.TRUST_PROXY ? 1 : false);

// Correlation id first so every later log line and error carries it.
app.use(requestId);

// Security headers next, so they apply to every response including errors.
app.use(helmet());

// Only listed browser origins may call this API. Server-to-server callers
// (the Next.js server) are not subject to CORS.
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Access logs go through winston so they land in logs/ alongside everything else.
morgan.token("id", (req: Request) => req.id);
app.use(
  morgan(
    isProduction
      ? ':id :remote-addr ":method :url" :status :res[content-length] :response-time ms ":user-agent"'
      : ":id :method :url :status :response-time ms",
    { stream: morganStream },
  ),
);

// Liveness probe. Unversioned on purpose: infrastructure must not care about
// API versions. Add /health/ready with dependency checks once there are any.
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "Server status OK",
  });
});

// Throttle the business API only; probes and preflights stay unthrottled.
app.use(
  API_PREFIX,
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Route through the shared error handler so the body has the usual shape.
    handler: (_req, _res, next) => next(new TooManyRequestsError()),
  }),
  createApiRouter(),
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
