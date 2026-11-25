import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { getDatabaseClient } from "../../database/client.js";
import { HttpError } from "../../shared/HttpError.js";
import type { PublicOrganization, PublicUser } from "./auth.types.js";
import { refreshTokenIsUsable } from "./auth.policy.js";
import {
  revokeInvalidRefreshTokenSessions,
  revokeRefreshTokenFamily,
  revokeRefreshTokenScope,
  type RefreshTokenRevocationStore,
} from "./auth.session.js";
import { createAccessToken, createRefreshToken, hashRefreshToken } from "./auth.tokens.js";

type CreatedSession = {
  id: string;
  userId: string;
  activeOrganizationId: string | null;
  familyId: string;
  rawToken: string;
};

function publicUser(user: { id: string; name: string; email: string }): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}

function refreshTokenRevocationStore(
  delegate: Prisma.TransactionClient["refreshToken"],
): RefreshTokenRevocationStore {
  return {
    findFamilyIdByTokenHash: async (tokenHash) => {
      const token = await delegate.findUnique({
        where: { tokenHash },
        select: { familyId: true },
      });
      return token?.familyId ?? null;
    },
    revokeUnrevoked: async (scope, revokedAt) => {
      const result = await delegate.updateMany({
        where: { ...scope, revokedAt: null },
        data: { revokedAt },
      });
      return result.count;
    },
  };
}

async function createRefreshTokenRecord(
  transaction: Prisma.TransactionClient,
  userId: string,
  activeOrganizationId: string | null,
  familyId = randomUUID(),
  id = randomUUID(),
): Promise<CreatedSession> {
  const rawToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await transaction.refreshToken.create({
    data: {
      id,
      userId,
      activeOrganizationId,
      familyId,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt,
    },
  });

  return { id, userId, activeOrganizationId, familyId, rawToken };
}

async function createTokenPair(
  session: CreatedSession,
): Promise<{ accessToken: string; refreshToken: string }> {
  return {
    accessToken: await createAccessToken({
      userId: session.userId,
      refreshTokenId: session.id,
      activeOrganizationId: session.activeOrganizationId,
    }),
    refreshToken: session.rawToken,
  };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}> {
  const database = getDatabaseClient();
  const passwordHash = await hash(input.password, 12);
  const result = await database.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
      select: { id: true, name: true, email: true },
    });
    const session = await createRefreshTokenRecord(transaction, user.id, null);
    return { user, session };
  });

  return { user: publicUser(result.user), ...(await createTokenPair(result.session)) };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}> {
  const database = getDatabaseClient();
  const user = await database.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, passwordHash: true, status: true },
  });

  if (
    !user ||
    !(await credentialsAreValid(
      { passwordHash: user.passwordHash, status: user.status },
      input.password,
    ))
  ) {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  const session = await database.$transaction((transaction) =>
    createRefreshTokenRecord(transaction, user.id, null),
  );

  return {
    user: publicUser(user),
    ...(await createTokenPair(session)),
  };
}

export async function credentialsAreValid(
  user: { passwordHash: string; status: "ACTIVE" | "DISABLED" } | null,
  password: string,
): Promise<boolean> {
  return Boolean(user && user.status === "ACTIVE" && (await compare(password, user.passwordHash)));
}

export async function rotateRefreshToken(rawToken: string): Promise<{
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
} | null> {
  const database = getDatabaseClient();
  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  const result = await database.$transaction(async (transaction) => {
    const current = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });

    if (!current) {
      return null;
    }

    if (!refreshTokenIsUsable(current, current.user.status, now)) {
      await revokeInvalidRefreshTokenSessions(
        refreshTokenRevocationStore(transaction.refreshToken),
        current.user.status,
        current.userId,
        current.familyId,
        now,
      );
      return null;
    }

    let activeOrganizationId = current.activeOrganizationId;
    if (activeOrganizationId) {
      const membership = await transaction.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: activeOrganizationId,
            userId: current.userId,
          },
        },
        select: {
          status: true,
          organization: { select: { status: true, deletedAt: true } },
        },
      });

      if (
        membership?.status !== "ACTIVE" ||
        membership.organization.status !== "ACTIVE" ||
        membership.organization.deletedAt
      ) {
        activeOrganizationId = null;
      }
    }

    const replacementId = randomUUID();
    const rawReplacementToken = createRefreshToken();
    const replacementExpiresAt = new Date(
      now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const revoked = await transaction.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });

    if (revoked.count !== 1) {
      await revokeRefreshTokenScope(
        refreshTokenRevocationStore(transaction.refreshToken),
        { familyId: current.familyId },
        now,
      );
      return null;
    }

    const replacement = await transaction.refreshToken.create({
      data: {
        id: replacementId,
        userId: current.userId,
        activeOrganizationId,
        familyId: current.familyId,
        tokenHash: hashRefreshToken(rawReplacementToken),
        expiresAt: replacementExpiresAt,
      },
    });
    await transaction.refreshToken.update({
      where: { id: current.id },
      data: { replacedByTokenId: replacement.id },
    });

    return {
      user: publicUser(current.user),
      session: {
        id: replacement.id,
        userId: replacement.userId,
        activeOrganizationId: replacement.activeOrganizationId,
        familyId: replacement.familyId,
        rawToken: rawReplacementToken,
      },
    };
  });

  if (!result) {
    return null;
  }

  return {
    user: result.user,
    ...(await createTokenPair(result.session)),
  };
}

export async function logoutRefreshFamily(rawToken: string | undefined): Promise<void> {
  if (!rawToken) {
    return;
  }

  const database = getDatabaseClient();
  await revokeRefreshTokenFamily(
    rawToken,
    refreshTokenRevocationStore(database.refreshToken),
    new Date(),
  );
}

export async function getUserOrganizations(userId: string): Promise<PublicOrganization[]> {
  const database = getDatabaseClient();
  const memberships = await database.organizationMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
      organization: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      organization: { select: { id: true, name: true, slug: true } },
      role: { select: { slug: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map(({ organization, role }) => ({
    ...organization,
    role: role.slug,
  }));
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
