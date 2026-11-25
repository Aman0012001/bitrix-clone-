# Database schema

This document describes the locally approved initial BusinessHub authentication and tenant schema. The generated migration is at `backend/prisma/migrations/20260602120000_auth_multitenant_foundation/migration.sql`. It has not been applied to Neon or any other database.

## Models

| Model | Purpose | Important constraints |
| --- | --- | --- |
| `User` | Account identity and bcrypt password hash | UUID primary key; unique canonical lowercase email; status index |
| `Organization` | Tenant/company and authoritative owner | UUID primary key; globally unique canonical lowercase slug; owner FK; status/deletion index |
| `OrganizationMember` | A user's membership and organization-scoped role | Unique `(organizationId, userId)`; composite role FK `(organizationId, roleId)` prevents cross-organization role assignment; user/status and organization indexes |
| `Role` | Organization-specific role, including four system roles | Unique `(organizationId, slug)`; composite unique key supports tenant-safe membership FK; system/custom roles are distinguished |
| `Permission` | Shared module/action permission catalog | Unique `(module, action)` |
| `RolePermission` | Grants a permission to a role | Unique `(roleId, permissionId)` |
| `RefreshToken` | Hashed refresh-token session, rotation family, and active organization | Unique token digest and replacement link; indexes for user/revocation/expiry, family, active organization, and expiry |

UUID identifiers are used throughout. Timestamps use `timestamptz`; mutable records have `createdAt` and `updatedAt` as applicable. Organization and membership status enums distinguish active, suspended, left, and deleted states.

## Relationships and deletion behavior

- A user can own many organizations and have many memberships.
- Each organization has one authoritative `ownerUserId`, many memberships, and organization-scoped roles.
- A membership references both a user and an organization, and its role must belong to that same organization.
- Roles have many permission grants; permission definitions are shared across organizations.
- Refresh sessions belong to a user and may carry an active organization. Their rotation chain is a self-relation.
- Membership and role foreign keys use `RESTRICT` to avoid accidental tenant/authorization graph deletion. Refresh tokens cascade with user deletion; active organization and replaced-token links use `SET NULL`.
- Organization slugs remain globally reserved after soft deletion because the unique index is not partial.

## Tenant and role invariants

Membership lookup and switching require both the authenticated `userId` and requested `organizationId`; possession of an organization UUID is not authorization. The current active-organization middleware checks active membership, organization status, and soft-deletion state, then attaches the authorized tenant and role permissions to the request. Future business queries must include this tenant ID and use composite tenant foreign keys where applicable.

Each organization receives exactly one system role for each of `owner`, `admin`, `manager`, and `employee`. Organization creation creates all four roles, their initial grants, and the Owner membership in one database transaction. `Organization.ownerUserId` must match exactly one active membership assigned to the system Owner role; no other active member may use that system Owner role. Owner authorization is also derived from the organization's authoritative owner ID.

The migration adds PostgreSQL checks for canonical emails/slugs, valid role slugs, soft-delete/status consistency, membership left-state consistency, and token digest format. Deferred constraint triggers check the four system roles and owner membership at transaction commit, allowing organization creation to build the complete invariant inside one transaction.

Future tenant-owned data must include `organizationId` in its primary/unique keys and foreign-key relationships where appropriate. Do not depend on frontend filtering. PostgreSQL Row Level Security remains a future hardening option and is not enabled until transaction-safe tenant context is designed for pooled connections.

## Refresh-token storage

Refresh tokens are generated as opaque random values and sent only in HttpOnly cookies. The database stores SHA-256 digests, not the raw values. Rotation inserts a replacement and marks the previous token revoked in the same transaction. Reuse of a revoked token revokes the unrevoked rows in its family. Logout revokes the presented token's family. Access-token validation checks its session row so a revoked session cannot continue making authenticated requests.

## Migration boundary

The SQL file was generated offline from the Prisma schema and then extended with PostgreSQL-only constraints/triggers. It is a proposed initial migration, not an applied migration. No migration or database write has been run. Review the SQL and obtain explicit approval before running any migration command. No database-backed integration test has been performed; those tests require separate authorization to connect to a configured database.
