import type { Server } from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import logger from "./config/logger.js";

const server: Server = app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT}`);
});

/** Grace period for in-flight requests before the process is forced down. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Stop accepting new connections, then let winston flush before the process dies. */
const shutdown = (signal: string): void => {
  logger.info(`${signal} received, shutting down gracefully`);

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

  // close() only stops new connections; idle keep-alive sockets would
  // otherwise hold it open until the platform kills us.
  server.closeIdleConnections();

  // Backstop: an in-flight request that never finishes must not block a
  // deploy. unref() keeps the timer from holding an otherwise clean exit.
  setTimeout(() => {
    logger.error(`Forcing shutdown after ${SHUTDOWN_TIMEOUT_MS}ms`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
