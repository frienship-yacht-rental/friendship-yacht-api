import type { RequestHandler } from "express";
import { z } from "zod";
import { ValidationError } from "../lib/errors.js";

export interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/** The parsed, typed result of `validate(schemas)` for a given schema set. */
export type Validated<S extends Schemas> = {
  body: S["body"] extends z.ZodType ? z.infer<S["body"]> : undefined;
  query: S["query"] extends z.ZodType ? z.infer<S["query"]> : undefined;
  params: S["params"] extends z.ZodType ? z.infer<S["params"]> : undefined;
};

declare module "express-serve-static-core" {
  interface Request {
    /** Populated by `validate()`. Read it through `validated(req)` for typing. */
    validated?: { body: unknown; query: unknown; params: unknown };
  }
}

/**
 * Parses body, query and params against Zod schemas before the controller
 * runs. Unknown keys are stripped, so a controller only ever sees the fields
 * the schema declares. Express 5 exposes `req.query` as a getter, so parsed
 * values live on `req.validated` rather than being written back.
 */
export function validate<S extends Schemas>(schemas: S): RequestHandler {
  return (req, _res, next) => {
    const issues: Record<string, unknown> = {};
    const result: { body: unknown; query: unknown; params: unknown } = {
      body: undefined,
      query: undefined,
      params: undefined,
    };

    for (const part of ["body", "query", "params"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const parsed = schema.safeParse(req[part]);
      if (parsed.success) {
        result[part] = parsed.data;
      } else {
        issues[part] = z.flattenError(parsed.error);
      }
    }

    if (Object.keys(issues).length > 0) {
      next(new ValidationError(issues));
      return;
    }

    req.validated = result;
    next();
  };
}

/** Typed accessor for what `validate()` parsed. Throws if the middleware is missing. */
export function validated<S extends Schemas>(
  req: { validated?: { body: unknown; query: unknown; params: unknown } },
  _schemas: S,
): Validated<S> {
  if (!req.validated) {
    throw new Error("validated() called on a route without validate() middleware");
  }
  return req.validated as Validated<S>;
}
