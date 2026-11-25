import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../shared/HttpError.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const allowedOrigins = new Set(env.CORS_ORIGIN);

export const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
  if (!unsafeMethods.has(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  if (!origin || !allowedOrigins.has(origin)) {
    next(new HttpError(403, "Request origin is not allowed."));
    return;
  }

  next();
};
