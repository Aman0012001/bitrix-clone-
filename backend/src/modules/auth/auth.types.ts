export type AuthContext = {
  userId: string;
  refreshTokenId: string;
  activeOrganizationId: string | null;
};

export type TenantContext = {
  organizationId: string;
  membershipId: string;
  roleId: string;
  roleSlug: string;
  isOwner: boolean;
  permissions: ReadonlySet<string>;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};
