import type { RequestHandler } from "express";
import { getDatabaseClient } from "../database/client.js";
import { HttpError } from "../shared/HttpError.js";
import { accessCookieName, readCookie } from "../modules/auth/auth.cookies.js";
import { refreshTokenIsUsable } from "../modules/auth/auth.policy.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";

export const requireAuthentication: RequestHandler = async (request, _response, next) => {
  const rawAccessToken = readCookie(request, accessCookieName);
  if (!rawAccessToken) {
    next(new HttpError(401, "Authentication is required."));
    return;
  }

  const claims = await verifyAccessToken(rawAccessToken);
  if (!claims) {
    next(new HttpError(401, "Authentication is required."));
    return;
  }

  const database = getDatabaseClient();
  const session = await database.refreshToken.findUnique({
    where: { id: claims.refreshTokenId },
    select: {
      id: true,
      userId: true,
      activeOrganizationId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { status: true } },
    },
  });

  if (
    !session ||
    session.userId !== claims.userId ||
    !refreshTokenIsUsable(session, session.user.status, new Date()) ||
    session.activeOrganizationId !== claims.activeOrganizationId
  ) {
    next(new HttpError(401, "Authentication is required."));
    return;
  }

  request.auth = {
    userId: session.userId,
    refreshTokenId: session.id,
    activeOrganizationId: session.activeOrganizationId,
  };
  next();
};

export function requireAuthContext(request: Express.Request) {
  if (!request.auth) {
    throw new HttpError(401, "Authentication is required.");
  }
  return request.auth;
}
