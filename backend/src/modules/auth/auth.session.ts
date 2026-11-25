import type { UserStatus } from "../../generated/prisma/enums.js";
import { hashRefreshToken } from "./auth.tokens.js";

export type RefreshTokenRevocationScope = { familyId: string } | { userId: string };

export interface RefreshTokenRevocationStore {
  findFamilyIdByTokenHash(tokenHash: string): Promise<string | null>;
  revokeUnrevoked(scope: RefreshTokenRevocationScope, revokedAt: Date): Promise<number>;
}

export function invalidRefreshTokenRevocationScope(
  userStatus: UserStatus,
  userId: string,
  familyId: string,
): RefreshTokenRevocationScope {
  return userStatus === "ACTIVE" ? { familyId } : { userId };
}

export async function revokeRefreshTokenScope(
  store: RefreshTokenRevocationStore,
  scope: RefreshTokenRevocationScope,
  revokedAt: Date,
): Promise<number> {
  return store.revokeUnrevoked(scope, revokedAt);
}

export async function revokeInvalidRefreshTokenSessions(
  store: RefreshTokenRevocationStore,
  userStatus: UserStatus,
  userId: string,
  familyId: string,
  revokedAt: Date,
): Promise<number> {
  return revokeRefreshTokenScope(
    store,
    invalidRefreshTokenRevocationScope(userStatus, userId, familyId),
    revokedAt,
  );
}

export async function revokeRefreshTokenFamily(
  rawToken: string | undefined,
  store: RefreshTokenRevocationStore,
  revokedAt: Date,
): Promise<number> {
  if (!rawToken) {
    return 0;
  }

  const familyId = await store.findFamilyIdByTokenHash(hashRefreshToken(rawToken));
  if (!familyId) {
    return 0;
  }

  return revokeRefreshTokenScope(store, { familyId }, revokedAt);
}
