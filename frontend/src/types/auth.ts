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

export type CurrentUserResponse = {
  user: PublicUser;
  organizations: PublicOrganization[];
  activeOrganization: PublicOrganization | null;
};
