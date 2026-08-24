-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "ltree";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('viewer', 'contributor', 'stores_manager', 'admin');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('warehouse', 'room', 'cabinet', 'rack', 'shelf', 'bin', 'box', 'position', 'other');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('registered', 'available', 'reserved', 'issued', 'damaged', 'under_repair', 'lost', 'retired', 'disposed');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('receive', 'issue', 'consume', 'return', 'adjust', 'transfer_out', 'transfer_in', 'reconciliation', 'dispose');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'fulfilled', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('pending_scan', 'available', 'quarantined', 'failed');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('contains', 'mounted_on', 'subsystem_of', 'spare_for');

-- CreateEnum
CREATE TYPE "PolymorphicTargetType" AS ENUM ('asset_instance', 'inventory_item');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deactivated_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "step_up_verified_at" TIMESTAMPTZ,
    "ip_address" INET NOT NULL,
    "user_agent" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_credentials" (
    "user_id" UUID NOT NULL,
    "secret_encrypted" BYTEA NOT NULL,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recovery_codes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "totp_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "UserRole" NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permission_id")
);

-- CreateTable
CREATE TABLE "security_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "require_2fa_for_viewer" BOOLEAN NOT NULL DEFAULT false,
    "session_idle_timeout_minutes" INTEGER NOT NULL DEFAULT 45,
    "session_absolute_lifetime_hours" INTEGER NOT NULL DEFAULT 12,
    "large_reconciliation_threshold" INTEGER NOT NULL DEFAULT 100,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "before_state" JSONB,
    "after_state" JSONB,
    "session_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_sessions_user_active" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_expiry" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_user" ON "password_reset_tokens"("user_id", "used_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "idx_audit_actor_time" ON "audit_log"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_target" ON "audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_audit_action_time" ON "audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_created_at" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
