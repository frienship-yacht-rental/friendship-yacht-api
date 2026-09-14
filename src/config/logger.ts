import path from "node:path";
import winston from "winston";
import { env, isProduction, isTest } from "./env.js";

const { colorize, combine, errors, json, printf, splat, timestamp, uncolorize } =
  winston.format;

/**
 * Every log file is written to a `logs/` folder at the project root. The path is
 * resolved from the process working directory rather than the module URL so the
 * location stays the same whether the app runs from `src/` (tsx) or `dist/` (node).
 */
export const LOG_DIR = path.resolve(process.cwd(), "logs");

const level = env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

/** Shared across every file transport: rotate at 5 MB and keep the last 5 files. */
const fileRotation = {
  maxsize: 5 * 1024 * 1024,
  maxFiles: 5,
  tailable: true,
} as const;

/** Structured, one JSON object per line — what the files get. */
const fileFormat = combine(
  errors({ stack: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  splat(),
  uncolorize(),
  json(),
);

/** Human readable, colourised — what the terminal gets. */
const consoleFormat = combine(
  errors({ stack: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  splat(),
  colorize({ level: true }),
  printf((info) => {
    // `service` is useful in the files but only repeats itself on the terminal.
    const {
      level: lvl,
      message,
      timestamp: ts,
      stack,
      service: _service,
      ...meta
    } = info;
    const details = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${String(ts)} ${lvl}: ${String(stack ?? message)}${details}`;
  }),
);

const logger = winston.createLogger({
  level,
  levels: winston.config.npm.levels,
  format: fileFormat,
  defaultMeta: { service: "friendship-yachts-backend" },
  transports: [
    // Errors only, so a failure is never buried in the noise of the combined log.
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      ...fileRotation,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      ...fileRotation,
    }),
  ],
  // Crashes are written to their own files before the process exits, so the
  // cause is never lost. Winston's default (exitOnError: true) does the exit
  // once the transports have flushed; resuming after an uncaught exception
  // would leave the process in an undefined state.
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, "exceptions.log"),
      ...fileRotation,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, "rejections.log"),
      ...fileRotation,
    }),
  ],
});

// Tests would otherwise spam the reporter with request logs.
if (!isTest) {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

/** Sink handed to morgan so HTTP access logs travel through winston, not stdout. */
export const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

export default logger;
