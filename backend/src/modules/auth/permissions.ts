export const permissionCatalog = [
  { module: "organization", action: "read", description: "View organization settings." },
  { module: "organization", action: "update", description: "Update organization settings." },
  { module: "members", action: "read", description: "View organization members." },
  { module: "members", action: "manage", description: "Manage organization members." },
  { module: "roles", action: "read", description: "View organization roles." },
  { module: "roles", action: "manage", description: "Manage organization roles." },
  { module: "dashboard", action: "read", description: "View the organization dashboard." },
  { module: "contacts", action: "read", description: "View organization contacts." },
  { module: "contacts", action: "write", description: "Manage organization contacts." },
  { module: "companies", action: "read", description: "View organization companies." },
  { module: "companies", action: "write", description: "Manage organization companies." },
  { module: "leads", action: "read", description: "View organization leads." },
  { module: "leads", action: "write", description: "Manage organization leads." },
  { module: "deals", action: "read", description: "View organization deals." },
  { module: "deals", action: "write", description: "Manage organization deals." },
  { module: "tasks", action: "read", description: "View organization tasks." },
  { module: "tasks", action: "write", description: "Manage organization tasks." },
  { module: "activities", action: "read", description: "View organization activities." },
  { module: "activities", action: "write", description: "Manage organization activities." },
  { module: "projects", action: "read", description: "View organization projects." },
  { module: "projects", action: "write", description: "Manage organization projects." },
  { module: "reports", action: "read", description: "View organization reports." },
  { module: "settings", action: "read", description: "View organization settings." },
  { module: "settings", action: "write", description: "Manage organization settings." },
] as const;

export type PermissionKey = `${(typeof permissionCatalog)[number]["module"]}.${(typeof permissionCatalog)[number]["action"]}`;

const allPermissions = permissionCatalog.map(({ module, action }) => `${module}.${action}`);

export const systemRoles = [
  {
    name: "Owner",
    slug: "owner",
    description: "Organization owner with full organization access.",
    permissions: allPermissions,
  },
  {
    name: "Admin",
    slug: "admin",
    description: "Administrator for day-to-day organization management.",
    permissions: allPermissions.filter((permission) => permission !== "organization.update"),
  },
  {
    name: "Manager",
    slug: "manager",
    description: "Manager with operational access across business modules.",
    permissions: [
      "dashboard.read",
      "contacts.read",
      "contacts.write",
      "companies.read",
      "companies.write",
      "leads.read",
      "leads.write",
      "deals.read",
      "deals.write",
      "tasks.read",
      "tasks.write",
      "activities.read",
      "activities.write",
      "projects.read",
      "projects.write",
      "reports.read",
    ],
  },
  {
    name: "Employee",
    slug: "employee",
    description: "Employee with access to day-to-day work.",
    permissions: [
      "dashboard.read",
      "tasks.read",
      "tasks.write",
      "activities.read",
      "activities.write",
    ],
  },
] as const;

export function permissionKey(module: string, action: string): string {
  return `${module}.${action}`;
}
