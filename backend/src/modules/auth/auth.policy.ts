import type { MembershipStatus, OrganizationStatus, UserStatus } from "../../generated/prisma/enums.js";

export function refreshTokenIsUsable(
  token: { revokedAt: Date | null; expiresAt: Date },
  userStatus: UserStatus,
  now: Date,
): boolean {
  return token.revokedAt === null && token.expiresAt > now && userStatus === "ACTIVE";
}

export function membershipAllowsOrganization(
  membership:
    | {
        userId: string;
        organizationId: string;
        status: MembershipStatus;
        organizationStatus: OrganizationStatus;
        organizationDeletedAt: Date | null;
      }
    | null,
  userId: string,
  organizationId: string,
): boolean {
  return Boolean(
    membership &&
      membership.userId === userId &&
      membership.organizationId === organizationId &&
      membership.status === "ACTIVE" &&
      membership.organizationStatus === "ACTIVE" &&
      membership.organizationDeletedAt === null,
  );
}
