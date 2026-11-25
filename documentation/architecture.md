# BusinessHub architecture

BusinessHub is a TypeScript modular monolith with two independently built npm workspaces: a React/Vite frontend and an Express API. The application is designed for multiple organizations without introducing microservices or trusting frontend-only access controls.

## Frontend

`frontend/src` separates reusable components, layouts, pages, routes, services, types, and feature modules. The authentication provider bootstraps the current session, sends requests with cookies, and maintains the current user and active organization in memory. Protected routes redirect users to sign-in or organization selection. No long-lived authentication token is stored in browser storage.

## Backend

`backend/src/app.ts` composes middleware and module routers; `server.ts` owns process startup. Authentication and organization routes keep their request schemas, services, token utilities, and permissions inside their respective modules. Cross-cutting authentication, tenant, origin, logging, and error middleware live under `middleware`; shared errors and types live under `shared`.

The current public API includes registration, login, logout, refresh, current-user lookup, organization creation/listing, and organization switching. Future routes should be added to their owning modules and registered by the application composition root.

## Authentication and session lifecycle

- Passwords are bcrypt-hashed; password hashes are never serialized to clients.
- Access JWTs are short-lived, signed with `JWT_ACCESS_SECRET`, and delivered only in an HttpOnly cookie.
- Refresh tokens are opaque random values. Only SHA-256 digests are persisted.
- Refresh rotates the token in a database transaction, records the replacement link, and revokes the family if an already-revoked token is replayed.
- Authentication middleware checks the token signature and the corresponding database session on each protected request, so revocation and disabled users take effect without waiting for JWT expiry.
- Logout revokes the refresh-token family. Suspended or deleted organizations and inactive memberships cannot be selected or used as active tenant context; refresh clears stale organization context.
- Unsafe methods require an allowed `Origin`; CORS allows credentialed requests only from configured origins.

The rate limiter currently uses process-local memory. Use a shared backing store before running multiple API instances.

## Multi-tenant authorization

One user can have one membership in each organization and can therefore belong to many organizations. Each membership points to a role scoped to the same organization using a composite foreign key. Organization creation transactionally creates the organization, four system roles, permission grants, an active Owner membership, and the initial active-organization session context.

For any future organization-specific route:

1. Require a valid authenticated session.
2. Resolve the active organization from the signed session context, not an untrusted request body.
3. Query the membership by both `(organizationId, userId)` and reject missing, inactive, suspended, or deleted access.
4. Enforce the required permission (the organization owner has full access).
5. Scope every business-data read, update, and delete by the authorized `organizationId`. Prefer composite tenant foreign keys between tenant-owned tables so records cannot reference another tenant's rows.

Organization listing is restricted to active memberships for the authenticated user. Organization switching repeats the membership and organization-state checks server-side. Frontend hiding is only a usability measure, not an authorization boundary.

PostgreSQL Row Level Security is a possible future defense-in-depth measure. It is not enabled: pooled connections require transaction-safe tenant context and a complete strategy for all queries before RLS can be applied safely.

## Database boundary

Neon PostgreSQL is accessed through Prisma 7.10.1. The reusable database client uses `DATABASE_URL` (the pooled URL); Prisma CLI uses `DIRECT_URL` (the direct URL), with `DATABASE_URL_UNPOOLED` as a fallback. No credentials are required for type-checking or building.

The initial Prisma schema and generated SQL migration are present locally. The migration has not been applied and must be reviewed and separately approved before any database write. Additional PostgreSQL checks and deferred constraint triggers are included in that SQL migration because Prisma schema syntax cannot represent them; future migration reviews must preserve those invariants.

## Module expansion strategy

Add a frontend and backend module for each approved capability (for example CRM, tasks, or projects). Keep feature-specific pages, API clients, routes, and domain rules together, expose explicit interfaces between modules, and keep shared code limited to stable cross-cutting concerns. Every organization-owned table must include `organizationId`, tenant-aware indexes, and foreign keys that preserve tenant boundaries. Add migrations only after schema review and approval.
