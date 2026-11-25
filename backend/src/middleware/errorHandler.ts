import type { ErrorRequestHandler } from "express";
import { HttpError } from "../shared/HttpError.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error("Unhandled request error", errorName);
  response.status(500).json({ error: "Internal server error" });
};
