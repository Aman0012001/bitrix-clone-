import type { RequestHandler } from "express";
import { getDatabaseClient } from "../database/client.js";
import { HttpError } from "../shared/HttpError.js";
import { membershipAllowsOrganization } from "../modules/auth/auth.policy.js";
import { requireAuthContext } from "./requireAuthentication.js";

export const requireActiveOrganization: RequestHandler = async (request, _response, next) => {
  const auth = requireAuthContext(request);
  if (!auth.activeOrganizationId) {
    next(new HttpError(403, "Select an active organization."));
    return;
  }

  const database = getDatabaseClient();
  const membership = await database.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
    },
    select: {
      id: true,
      roleId: true,
      status: true,
      organization: {
        select: {
          id: true,
          ownerUserId: true,
          status: true,
          deletedAt: true,
        },
      },
      role: {
        select: {
          slug: true,
          permissions: {
            select: { permission: { select: { module: true, action: true } } },
          },
        },
      },
    },
  });

  if (
    !membership ||
    !membershipAllowsOrganization(
      {
        userId: auth.userId,
        organizationId: membership.organization.id,
        status: membership.status,
        organizationStatus: membership.organization.status,
        organizationDeletedAt: membership.organization.deletedAt,
      },
      auth.userId,
      auth.activeOrganizationId,
    )
  ) {
    next(new HttpError(403, "You do not have active access to this organization."));
    return;
  }

  request.tenant = {
    organizationId: membership.organization.id,
    membershipId: membership.id,
    roleId: membership.roleId,
    roleSlug: membership.role.slug,
    isOwner: membership.organization.ownerUserId === auth.userId,
    permissions: new Set(
      membership.role.permissions.map(({ permission }) => `${permission.module}.${permission.action}`),
    ),
  };
  next();
};

export function requirePermission(permission: string): RequestHandler {
  return (request, _response, next) => {
    const tenant = request.tenant;
    if (!tenant) {
      next(new HttpError(403, "An active organization is required."));
      return;
    }
    if (!tenant.isOwner && !tenant.permissions.has(permission)) {
      next(new HttpError(403, "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}
