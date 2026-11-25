import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requireTrustedOrigin } from "./middleware/requireTrustedOrigin.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { organizationRouter } from "./modules/organizations/organization.routes.js";
import { HttpError } from "./shared/HttpError.js";

export const app = express();

app.use(requestLogger);
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(requireTrustedOrigin);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/organizations", organizationRouter);
app.use((_request, _response, next) => {
  next(new HttpError(404, "Not found"));
});
app.use(errorHandler);
