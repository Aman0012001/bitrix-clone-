import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { SignJWT } from "jose";
import { env } from "../../config/env.js";
import { requirePermission as requireTenantPermission } from "../../middleware/requireTenant.js";
import { requireTrustedOrigin } from "../../middleware/requireTrustedOrigin.js";
import { HttpError } from "../../shared/HttpError.js";
import { hashRefreshToken, createRefreshToken, verifyAccessToken } from "./auth.tokens.js";
import { membershipAllowsOrganization, refreshTokenIsUsable } from "./auth.policy.js";
import {
  revokeInvalidRefreshTokenSessions,
  revokeRefreshTokenFamily,
} from "./auth.session.js";
import type {
  RefreshTokenRevocationScope,
  RefreshTokenRevocationStore,
} from "./auth.session.js";
import { loginSchema, registrationSchema } from "./auth.schemas.js";
import { credentialsAreValid, isUniqueConstraintViolation } from "./auth.service.js";

type RefreshSessionRecord = {
  tokenHash: string;
  userId: string;
  familyId: string;
  revokedAt: Date | null;
};

function createRefreshSessionStore(records: RefreshSessionRecord[]): RefreshTokenRevocationStore {
  return {
    findFamilyIdByTokenHash: async (tokenHash) =>
      records.find((record) => record.tokenHash === tokenHash)?.familyId ?? null,
    revokeUnrevoked: async (scope: RefreshTokenRevocationScope, revokedAt) => {
      let updated = 0;
      for (const record of records) {
        const matchesScope =
          "familyId" in scope
            ? record.familyId === scope.familyId
            : record.userId === scope.userId;
        if (matchesScope && record.revokedAt === null) {
          record.revokedAt = revokedAt;
          updated += 1;
        }
      }
      return updated;
    },
  };
}

test("registration canonicalizes email and enforces bcrypt's byte limit", () => {
  const parsed = registrationSchema.safeParse({
    name: " Ada Lovelace ",
    email: " ADA@example.com ",
    password: "A secure password 123",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.email, "ada@example.com");
    assert.equal(parsed.data.name, "Ada Lovelace");
  }

  assert.equal(
    registrationSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "é".repeat(37),
    }).success,
    false,
  );
});

test("login schema normalizes email and rejects oversized bcrypt inputs", () => {
  const parsed = loginSchema.safeParse({
    email: "USER@example.com",
    password: "a valid password",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.email, "user@example.com");
  }

  assert.equal(
    loginSchema.safeParse({
      email: "user@example.com",
      password: "é".repeat(37),
    }).success,
    false,
  );
});

test("invalid passwords and inactive accounts are rejected", async () => {
  const passwordHash = await (await import("bcryptjs")).hash("Correct horse battery staple", 4);
  assert.equal(await credentialsAreValid(null, "wrong password"), false);
  assert.equal(
    await credentialsAreValid(
      { passwordHash, status: "ACTIVE" },
      "incorrect password",
    ),
    false,
  );
  assert.equal(
    await credentialsAreValid(
      { passwordHash, status: "DISABLED" },
      "Correct horse battery staple",
    ),
    false,
  );
});

test("duplicate registration constraint errors are identifiable", () => {
  assert.equal(isUniqueConstraintViolation({ code: "P2002" }), true);
  assert.equal(isUniqueConstraintViolation({ code: "P2025" }), false);
});

test("expired access JWTs are rejected", async () => {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const expiredToken = await new SignJWT({ sid: "session-id", org: null })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("businesshub")
    .setAudience("businesshub-api")
    .setSubject("user-id")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
    .sign(secret);

  assert.equal(await verifyAccessToken(expiredToken), null);
});

test("refresh-token hashes do not store the raw token", () => {
  const token = createRefreshToken();
  const digest = hashRefreshToken(token);
  assert.notEqual(digest, token);
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test("revoked and expired refresh sessions are unusable", () => {
  const now = new Date();
  assert.equal(
    refreshTokenIsUsable(
      { revokedAt: new Date(now.getTime() - 1), expiresAt: new Date(now.getTime() + 60_000) },
      "ACTIVE",
      now,
    ),
    false,
  );
  assert.equal(
    refreshTokenIsUsable(
      { revokedAt: null, expiresAt: new Date(now.getTime() - 1) },
      "ACTIVE",
      now,
    ),
    false,
  );
  assert.equal(
    refreshTokenIsUsable(
      { revokedAt: null, expiresAt: new Date(now.getTime() + 60_000) },
      "DISABLED",
      now,
    ),
    false,
  );
});

test("reusing a revoked refresh token revokes only its remaining family sessions", async () => {
  const now = new Date();
  const replayedToken = createRefreshToken();
  const records = [
    {
      tokenHash: hashRefreshToken(replayedToken),
      userId: "user-a",
      familyId: "family-a",
      revokedAt: new Date(now.getTime() - 1),
    },
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-a",
      familyId: "family-a",
      revokedAt: null,
    },
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-a",
      familyId: "family-b",
      revokedAt: null,
    },
  ];
  const store = createRefreshSessionStore(records);

  const updated = await revokeInvalidRefreshTokenSessions(
    store,
    "ACTIVE",
    "user-a",
    "family-a",
    now,
  );

  assert.equal(updated, 1);
  assert.equal(records[1].revokedAt, now);
  assert.equal(records[2].revokedAt, null);
});

test("logout revokes all unrevoked sessions in the token family", async () => {
  const rawToken = createRefreshToken();
  const records = [
    {
      tokenHash: hashRefreshToken(rawToken),
      userId: "user-a",
      familyId: "family-a",
      revokedAt: null,
    },
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-a",
      familyId: "family-a",
      revokedAt: null,
    },
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-a",
      familyId: "family-b",
      revokedAt: null,
    },
  ];
  const now = new Date();

  const updated = await revokeRefreshTokenFamily(
    rawToken,
    createRefreshSessionStore(records),
    now,
  );

  assert.equal(updated, 2);
  assert.equal(records[0].revokedAt, now);
  assert.equal(records[1].revokedAt, now);
  assert.equal(records[2].revokedAt, null);
});

test("disabled accounts revoke all active refresh sessions", async () => {
  const records = [
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-a",
      familyId: "family-a",
      revokedAt: null,
    },
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-a",
      familyId: "family-b",
      revokedAt: null,
    },
    {
      tokenHash: hashRefreshToken(createRefreshToken()),
      userId: "user-b",
      familyId: "family-c",
      revokedAt: null,
    },
  ];
  const now = new Date();

  const updated = await revokeInvalidRefreshTokenSessions(
    createRefreshSessionStore(records),
    "DISABLED",
    "user-a",
    "family-a",
    now,
  );

  assert.equal(updated, 2);
  assert.equal(records[0].revokedAt, now);
  assert.equal(records[1].revokedAt, now);
  assert.equal(records[2].revokedAt, null);
});

test("tenant membership policy rejects another tenant and inactive memberships", () => {
  const membership = {
    userId: "user-a",
    organizationId: "org-a",
    status: "ACTIVE" as const,
    organizationStatus: "ACTIVE" as const,
    organizationDeletedAt: null,
  };

  assert.equal(membershipAllowsOrganization(membership, "user-a", "org-a"), true);
  assert.equal(membershipAllowsOrganization(membership, "user-a", "org-b"), false);
  assert.equal(membershipAllowsOrganization(null, "user-a", "org-a"), false);
  assert.equal(
    membershipAllowsOrganization({ ...membership, status: "SUSPENDED" }, "user-a", "org-a"),
    false,
  );
  assert.equal(
    membershipAllowsOrganization(
      { ...membership, organizationStatus: "SUSPENDED" },
      "user-a",
      "org-a",
    ),
    false,
  );
  assert.equal(
    membershipAllowsOrganization(
      { ...membership, organizationStatus: "DELETED", organizationDeletedAt: new Date() },
      "user-a",
      "org-a",
    ),
    false,
  );
  assert.equal(
    membershipAllowsOrganization({ ...membership, status: "LEFT" }, "user-a", "org-a"),
    false,
  );
});

test("tenant permission middleware denies unauthorized role changes and grants owner access", () => {
  function authorize(
    tenant: NonNullable<Express.Request["tenant"]> | undefined,
    permission: string,
  ): unknown {
    let error: unknown;
    const request = { tenant } as Request;
    const response = { locals: {} } as Response;
    const next: NextFunction = (nextError) => {
      error = nextError;
    };

    requireTenantPermission(permission)(request, response, next);
    return error;
  }

  const employeeTenant: NonNullable<Express.Request["tenant"]> = {
    organizationId: "org-a",
    membershipId: "member-a",
    roleId: "role-employee",
    roleSlug: "employee",
    isOwner: false,
    permissions: new Set(["roles.read"]),
  };

  assert.ok(authorize(employeeTenant, "roles.manage") instanceof HttpError);
  assert.equal(
    (authorize(employeeTenant, "roles.manage") as HttpError).statusCode,
    403,
  );
  assert.equal(
    authorize({ ...employeeTenant, isOwner: true, permissions: new Set() }, "roles.manage"),
    undefined,
  );
  assert.equal(authorize(undefined, "roles.manage") instanceof HttpError, true);
});

test("trusted-origin middleware rejects missing and foreign origins", () => {
  function run(origin: string | undefined): unknown {
    let error: unknown;
    const request = {
      method: "POST",
      get: (header: string) => (header.toLowerCase() === "origin" ? origin : undefined),
    } as Request;
    const response = { locals: {} } as Response;
    const next: NextFunction = (nextError) => {
      error = nextError;
    };

    requireTrustedOrigin(request, response, next);
    return error;
  }

  assert.equal((run(undefined) as HttpError).statusCode, 403);
  assert.equal((run("https://attacker.example") as HttpError).statusCode, 403);
  assert.equal(run(env.CORS_ORIGIN[0]), undefined);
});
