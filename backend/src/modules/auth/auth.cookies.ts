import type { Request, Response } from "express";
import { env } from "../../config/env.js";

export const accessCookieName = "businesshub_access";
export const refreshCookieName = "businesshub_refresh";

const isSecure = env.NODE_ENV === "production";

export function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
): void {
  setAccessCookie(response, accessToken);
  response.cookie(refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function setAccessCookie(response: Response, accessToken: string): void {
  response.cookie(accessCookieName, accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/api",
    maxAge: env.JWT_ACCESS_TOKEN_SECONDS * 1000,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(accessCookieName, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/api",
  });
  response.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/api/auth",
  });
}
