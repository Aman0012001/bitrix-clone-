import { Prisma } from "../../generated/prisma/client.js";
import { getDatabaseClient } from "../../database/client.js";
import { HttpError } from "../../shared/HttpError.js";
import type { PublicOrganization } from "../auth/auth.types.js";
import { createAccessToken } from "../auth/auth.tokens.js";
import { membershipAllowsOrganization } from "../auth/auth.policy.js";
import { permissionCatalog, systemRoles } from "../auth/permissions.js";

export async function createOrganization(input: {
  userId: string;
  refreshTokenId: string;
  name: string;
  slug: string;
}): Promise<{
  organization: PublicOrganization;
  accessToken: string;
}> {
  const database = getDatabaseClient();
  const result = await database.$transaction(async (transaction) => {
    const permissions = new Map<string, string>();
    for (const permission of permissionCatalog) {
      const saved = await transaction.permission.upsert({
        where: {
          module_action: {
            module: permission.module,
            action: permission.action,
          },
        },
        create: permission,
        update: { description: permission.description },
        select: { id: true, module: true, action: true },
      });
      permissions.set(`${saved.module}.${saved.action}`, saved.id);
    }

    const organization = await transaction.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        ownerUserId: input.userId,
      },
      select: { id: true, name: true, slug: true },
    });

    const createdRoles = new Map<string, { id: string; name: string }>();
    for (const roleDefinition of systemRoles) {
      const role = await transaction.role.create({
        data: {
          organizationId: organization.id,
          name: roleDefinition.name,
          slug: roleDefinition.slug,
          description: roleDefinition.description,
          isSystem: true,
        },
        select: { id: true, name: true },
      });
      createdRoles.set(roleDefinition.slug, role);

      const grants = roleDefinition.permissions.map((permissionKey) => {
        const permissionId = permissions.get(permissionKey);
        if (!permissionId) {
          throw new Error(`Permission catalog is missing ${permissionKey}.`);
        }
        return { roleId: role.id, permissionId };
      });

      await transaction.rolePermission.createMany({ data: grants });
    }

    const ownerRole = createdRoles.get("owner");
    if (!ownerRole) {
      throw new Error("The system Owner role is not configured.");
    }

    await transaction.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: input.userId,
        roleId: ownerRole.id,
        status: "ACTIVE",
      },
    });

    const sessionUpdate = await transaction.refreshToken.updateMany({
      where: {
        id: input.refreshTokenId,
        userId: input.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { activeOrganizationId: organization.id },
    });

    if (sessionUpdate.count !== 1) {
      throw new HttpError(401, "Authentication is required.");
    }

    return {
      organization,
      role: ownerRole.name,
      sessionId: input.refreshTokenId,
    };
  });

  return {
    organization: { ...result.organization, role: result.role },
    accessToken: await createAccessToken({
      userId: input.userId,
      refreshTokenId: result.sessionId,
      activeOrganizationId: result.organization.id,
    }),
  };
}

export async function listOrganizationsForUser(userId: string): Promise<PublicOrganization[]> {
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

export async function switchActiveOrganization(input: {
  userId: string;
  refreshTokenId: string;
  organizationId: string;
}): Promise<{ organization: PublicOrganization; accessToken: string }> {
  const database = getDatabaseClient();
  const membership = await database.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    select: {
      status: true,
      role: { select: { slug: true } },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (
    !membership ||
    !membershipAllowsOrganization(
      {
        userId: input.userId,
        organizationId: membership.organization.id,
        status: membership.status,
        organizationStatus: membership.organization.status,
        organizationDeletedAt: membership.organization.deletedAt,
      },
      input.userId,
      input.organizationId,
    )
  ) {
    throw new HttpError(404, "Organization not found.");
  }

  const updated = await database.refreshToken.updateMany({
    where: {
      id: input.refreshTokenId,
      userId: input.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { activeOrganizationId: input.organizationId },
  });

  if (updated.count !== 1) {
    throw new HttpError(401, "Authentication is required.");
  }

  return {
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role.slug,
    },
    accessToken: await createAccessToken({
      userId: input.userId,
      refreshTokenId: input.refreshTokenId,
      activeOrganizationId: input.organizationId,
    }),
  };
}

export function isOrganizationUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const targetName = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetName.toLowerCase().includes("slug");
}
