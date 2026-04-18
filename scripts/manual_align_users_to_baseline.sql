-- Align current database schema to Prisma baseline expectations.
-- This avoids `prisma migrate reset` by manually applying the missing pieces.

-- 1) Ensure auth-related columns exist
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) Match baseline: updated_at should not have a DB default (Prisma manages it)
ALTER TABLE "users"
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- 3) Recreate indexes declared in schema.prisma
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" ("status");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "users_status_role_idx" ON "users" ("status", "role");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");

