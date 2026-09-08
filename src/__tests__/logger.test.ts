import path from "node:path";
import { describe, expect, it } from "vitest";
import logger, { LOG_DIR, morganStream } from "../config/logger.js";

describe("logger", () => {
  it("writes its files to a logs/ folder at the project root", () => {
    expect(LOG_DIR).toBe(path.resolve(process.cwd(), "logs"));
  });

  it("registers a dedicated error file transport plus a combined one", () => {
    const filenames = logger.transports
      .map((transport) => (transport as { filename?: string }).filename)
      .filter((filename): filename is string => typeof filename === "string");

    expect(filenames).toContain("error.log");
    expect(filenames).toContain("combined.log");
  });

  it("exposes every npm level the app logs at", () => {
    expect(logger.levels).toMatchObject({
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6,
    });
  });

  it("forwards morgan output to the http level without a trailing newline", () => {
    const written: unknown[] = [];
    const original = logger.http.bind(logger);
    logger.http = ((message: string) => {
      written.push(message);
      return logger;
    }) as typeof logger.http;

    morganStream.write("GET /health 200 1.234 ms\n");
    logger.http = original;

    expect(written).toEqual(["GET /health 200 1.234 ms"]);
  });
});
