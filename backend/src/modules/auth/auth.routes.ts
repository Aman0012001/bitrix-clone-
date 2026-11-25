import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getDatabaseClient } from "../../database/client.js";
import { requireAuthentication, requireAuthContext } from "../../middleware/requireAuthentication.js";
import { HttpError } from "../../shared/HttpError.js";
import {
  clearAuthCookies,
  readCookie,
  refreshCookieName,
  setAuthCookies,
} from "./auth.cookies.js";
import {
  getUserOrganizations,
  isUniqueConstraintViolation,
  loginUser,
  logoutRefreshFamily,
  registerUser,
  rotateRefreshToken,
} from "./auth.service.js";
import { loginSchema, registrationSchema } from "./auth.schemas.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Try again later." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many token refresh attempts. Try again later." },
});

authRouter.post("/register", registrationLimiter, async (request, response) => {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, "Registration details are invalid.");
  }

  try {
    const result = await registerUser(parsed.data);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    response.status(201).json({ user: result.user });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new HttpError(409, "An account with this email already exists.");
    }
    throw error;
  }
});

authRouter.post("/login", loginLimiter, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, "Sign-in details are invalid.");
  }

  const result = await loginUser(parsed.data);
  setAuthCookies(response, result.accessToken, result.refreshToken);
  response.status(200).json({ user: result.user });
});

authRouter.post("/logout", async (request, response) => {
  await logoutRefreshFamily(readCookie(request, refreshCookieName));
  clearAuthCookies(response);
  response.status(204).end();
});

authRouter.post("/refresh", refreshLimiter, async (request, response) => {
  const rawToken = readCookie(request, refreshCookieName);
  if (!rawToken) {
    clearAuthCookies(response);
    throw new HttpError(401, "A valid refresh session is required.");
  }

  const result = await rotateRefreshToken(rawToken);
  if (!result) {
    clearAuthCookies(response);
    throw new HttpError(401, "A valid refresh session is required.");
  }

  setAuthCookies(response, result.accessToken, result.refreshToken);
  response.status(200).json({ user: result.user });
});

authRouter.get("/me", requireAuthentication, async (request, response) => {
  const auth = requireAuthContext(request);
  const database = getDatabaseClient();
  const user = await database.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new HttpError(401, "Authentication is required.");
  }

  const organizations = await getUserOrganizations(user.id);
  const activeOrganization =
    organizations.find(({ id }) => id === auth.activeOrganizationId) ?? null;

  response.status(200).json({
    user,
    organizations,
    activeOrganization,
  });
});
