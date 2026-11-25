import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../../config/env.js";

const jwtKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const jwtIssuer = "businesshub";
const jwtAudience = "businesshub-api";

export type AccessTokenClaims = {
  userId: string;
  refreshTokenId: string;
  activeOrganizationId: string | null;
};

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    sid: claims.refreshTokenId,
    org: claims.activeOrganizationId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TOKEN_SECONDS}s`)
    .sign(jwtKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtKey, {
      algorithms: ["HS256"],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      !(typeof payload.org === "string" || payload.org === null)
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      refreshTokenId: payload.sid,
      activeOrganizationId: payload.org,
    };
  } catch {
    return null;
  }
}
