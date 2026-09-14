import type { Server } from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import logger from "./config/logger.js";

const server: Server = app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT}`);
});

/** Stop accepting new connections, then let winston flush before the process dies. */
const shutdown = (signal: string): void => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
