import "dotenv/config";
import type { Server } from "node:http";
import app from "./app.js";
import logger from "./config/logger.js";

const port: string = process.env.PORT || "8000";

const server: Server = app.listen(port, () => {
  logger.info(`Server started on the port : http://localhost:${port}`);
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
