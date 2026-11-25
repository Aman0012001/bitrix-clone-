# BusinessHub

BusinessHub is a modular-monolith business management SaaS foundation built for multiple organizations. The current phase implements account authentication, organization membership and switching, organization-scoped roles and permissions, and a protected responsive frontend shell. It does not yet include CRM or other business records.

## Technology stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, TypeScript
- Database: Neon PostgreSQL with Prisma ORM 7.10.1 and `@prisma/adapter-neon`
- Package management: npm workspaces

## Project structure

```text
businesshub/
├── backend/
│   ├── prisma/
│   │   ├── migrations/       # Generated initial migration; not yet applied
│   │   └── schema.prisma
│   └── src/
│       ├── config/
│       ├── database/
│       ├── middleware/
│       ├── modules/
│       │   ├── auth/
│       │   └── organizations/
│       └── shared/
├── documentation/
│   ├── architecture.md
│   └── database-schema.md
├── frontend/
│   └── src/
│       ├── components/
│       ├── layouts/
│       ├── modules/auth/
│       ├── pages/
│       ├── routes/
│       ├── services/
│       └── types/
├── .env.example
└── package.json
```

## Installation

Requirements: Node.js 20.19+ and npm.

```bash
npm install
Copy-Item .env.example .env.local
```

Set a private, random `JWT_ACCESS_SECRET` of at least 32 characters in `.env.local`. Configure the database URLs as described below before using database-backed endpoints. `.env` and `.env.local` are excluded from Git; never commit or share their contents.

## Development

Run these in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

The API health endpoint is `http://localhost:3000/api/health`; the frontend is `http://localhost:5173`.

Run validation:

```bash
npm run typecheck
npm run build
npm test --workspace=@businesshub/backend
```

The authentication routes require a reachable database. Type-checking, building, and the focused policy/security tests do not require Neon credentials.

## Neon database configuration

1. Use the existing Neon project and production branch.
2. Set `DATABASE_URL` to Neon's pooled connection string (the hostname contains `-pooler`). The backend Prisma adapter uses this URL at runtime.
3. Set `DIRECT_URL` to Neon's direct, non-pooled connection string for Prisma CLI operations. `DATABASE_URL_UNPOOLED` is accepted as a fallback if Neon tooling provides that name.
4. Put the URLs only in `.env.local` or `.env`; do not put credentials in frontend variables.
5. Generate the Prisma Client with `npm run db:generate --workspace=@businesshub/backend`.

Both URLs may be absent for type-checking and building. This repository includes a proposed initial schema migration at `backend/prisma/migrations/20260602120000_auth_multitenant_foundation/migration.sql`; it has **not** been applied. Do not run `prisma migrate dev`, `prisma migrate deploy`, or any database-writing command until the migration has been reviewed and separately approved.

## Authentication and organizations

The API exposes:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a user |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Revoke the presented refresh-token family |
| `POST` | `/api/auth/refresh` | Rotate the refresh token and issue a new access token |
| `GET` | `/api/auth/me` | Return the current user, memberships, and active organization |
| `POST` | `/api/organizations` | Create an organization and its Owner membership/system roles |
| `GET` | `/api/organizations` | List active organizations the user belongs to |
| `POST` | `/api/organizations/:organizationId/switch` | Switch to an organization after server-side membership validation |

Passwords are stored as bcrypt hashes. Access JWTs are short-lived and held in HttpOnly cookies; opaque refresh tokens are also held in HttpOnly cookies, while only their SHA-256 digests are stored in the database. Refresh requests rotate tokens; replaying a revoked token revokes its family. Cookies use `Secure` in production and `SameSite=Lax`. Unsafe requests must carry an allowed `Origin`, configured with `CORS_ORIGIN`.

Organization-specific backend routes must use authentication, active-organization membership validation, and permission checks. Tenant-owned future records must always be queried and written with the authorized `organizationId`; client-supplied IDs are never authorization. See [documentation/architecture.md](documentation/architecture.md) and [documentation/database-schema.md](documentation/database-schema.md).

The current rate limiter uses an in-memory store and is per process. Replace it with a shared store before horizontal scaling. Email verification, password recovery, invitations, organization member administration, and business modules are not implemented yet.

## Environment variables

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | Defaults to `development` |
| `PORT` | API listening port | Defaults to `3000` |
| `CORS_ORIGIN` | Comma-separated allowed browser origins | Defaults to local Vite origin |
| `JWT_ACCESS_SECRET` | Secret used to sign access JWTs | Required; at least 32 characters |
| `JWT_ACCESS_TOKEN_SECONDS` | Access-token lifetime | Defaults to 900 seconds |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-token lifetime | Defaults to 30 days |
| `DATABASE_URL` | Neon pooled runtime connection | Required for database-backed requests |
| `DIRECT_URL` | Direct Prisma CLI connection | Required for migrations |
| `DATABASE_URL_UNPOOLED` | Optional direct-URL fallback | Optional |

The API validates its configuration at startup. Database connection strings and tokens must never be logged or returned by API responses.
