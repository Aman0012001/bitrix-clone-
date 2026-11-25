-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeOrganizationId" UUID,
    "tokenHash" CHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "replacedByTokenId" UUID,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerUserId_idx" ON "Organization"("ownerUserId");

-- CreateIndex
CREATE INDEX "Organization_status_deletedAt_idx" ON "Organization"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_status_idx" ON "OrganizationMember"("userId", "status");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_roleId_idx" ON "OrganizationMember"("organizationId", "roleId");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_status_idx" ON "OrganizationMember"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_id_key" ON "OrganizationMember"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Role_organizationId_isSystem_idx" ON "Role"("organizationId", "isSystem");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_slug_key" ON "Role"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_id_key" ON "Role"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_action_key" ON "Permission"("module", "action");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_replacedByTokenId_key" ON "RefreshToken"("replacedByTokenId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_expiresAt_idx" ON "RefreshToken"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_revokedAt_idx" ON "RefreshToken"("familyId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_activeOrganizationId_idx" ON "RefreshToken"("activeOrganizationId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_roleId_fkey" FOREIGN KEY ("organizationId", "roleId") REFERENCES "Role"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedByTokenId_fkey" FOREIGN KEY ("replacedByTokenId") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep canonical identifiers consistent even for writes outside the application.
ALTER TABLE "User"
    ADD CONSTRAINT "User_email_canonical_check"
    CHECK ("email" = lower("email") AND "email" = btrim("email"));

ALTER TABLE "Organization"
    ADD CONSTRAINT "Organization_slug_canonical_check"
    CHECK (
        "slug" = lower("slug")
        AND "slug" = btrim("slug")
        AND "slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    ),
    ADD CONSTRAINT "Organization_deletedAt_status_check"
    CHECK (("status" = 'DELETED') = ("deletedAt" IS NOT NULL));

ALTER TABLE "OrganizationMember"
    ADD CONSTRAINT "OrganizationMember_leftAt_status_check"
    CHECK (("status" = 'LEFT') = ("leftAt" IS NOT NULL));

ALTER TABLE "Role"
    ADD CONSTRAINT "Role_system_slug_check"
    CHECK (
        "slug" = lower("slug")
        AND "slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
        AND (
            ("isSystem" AND "slug" IN ('owner', 'admin', 'manager', 'employee'))
            OR
            (NOT "isSystem" AND "slug" NOT IN ('owner', 'admin', 'manager', 'employee'))
        )
    );

ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_tokenHash_format_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

CREATE FUNCTION assert_organization_foundation(target_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    expected_owner_user_id UUID;
BEGIN
    SELECT "ownerUserId"
    INTO expected_owner_user_id
    FROM "Organization"
    WHERE "id" = target_organization_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF (
        SELECT count(*)
        FROM "Role"
        WHERE "organizationId" = target_organization_id
          AND "isSystem"
          AND "slug" IN ('owner', 'admin', 'manager', 'employee')
    ) <> 4 THEN
        RAISE EXCEPTION 'Organization must have exactly the four required system roles.'
            USING ERRCODE = '23514';
    END IF;

    IF (
        SELECT count(*)
        FROM "OrganizationMember" AS member
        JOIN "Role" AS role
          ON role."organizationId" = member."organizationId"
         AND role."id" = member."roleId"
        WHERE member."organizationId" = target_organization_id
          AND member."userId" = expected_owner_user_id
          AND member."status" = 'ACTIVE'
          AND role."isSystem"
          AND role."slug" = 'owner'
    ) <> 1
    OR EXISTS (
        SELECT 1
        FROM "OrganizationMember" AS member
        JOIN "Role" AS role
          ON role."organizationId" = member."organizationId"
         AND role."id" = member."roleId"
        WHERE member."organizationId" = target_organization_id
          AND member."status" = 'ACTIVE'
          AND role."isSystem"
          AND role."slug" = 'owner'
          AND member."userId" <> expected_owner_user_id
    ) THEN
        RAISE EXCEPTION 'Organization must have exactly one active Owner membership matching ownerUserId.'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

CREATE FUNCTION enforce_organization_foundation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_organization_id UUID;
    new_organization_id UUID;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        IF TG_TABLE_NAME = 'Organization' THEN
            old_organization_id := OLD."id";
        ELSE
            old_organization_id := OLD."organizationId";
        END IF;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        IF TG_TABLE_NAME = 'Organization' THEN
            new_organization_id := NEW."id";
        ELSE
            new_organization_id := NEW."organizationId";
        END IF;
    END IF;

    IF old_organization_id IS NOT NULL THEN
        PERFORM assert_organization_foundation(old_organization_id);
    END IF;
    IF new_organization_id IS NOT NULL
       AND new_organization_id IS DISTINCT FROM old_organization_id THEN
        PERFORM assert_organization_foundation(new_organization_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "Organization_foundation_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "Organization"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_organization_foundation();

CREATE CONSTRAINT TRIGGER "Role_foundation_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "Role"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_organization_foundation();

CREATE CONSTRAINT TRIGGER "OrganizationMember_foundation_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "OrganizationMember"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_organization_foundation();
