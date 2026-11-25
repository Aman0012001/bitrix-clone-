import type { Request, Response } from "express";
import morgan from "morgan";

morgan.token<Request, Response>(
  "path",
  (request) => (request.originalUrl ?? "").split("?")[0],
);

export const requestLogger = morgan(":method :path :status :response-time ms");
