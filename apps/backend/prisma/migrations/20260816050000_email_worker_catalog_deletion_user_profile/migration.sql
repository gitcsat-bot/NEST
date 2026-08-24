-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'sent', 'failed');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "mis_id" VARCHAR(9);
ALTER TABLE "users" ADD COLUMN "gender" "Gender";

-- CreateIndex
CREATE UNIQUE INDEX "users_mis_id_key" ON "users"("mis_id");

-- CreateTable
CREATE TABLE "catalog_deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_definition_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "reason" TEXT,
    "status" "InventoryRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_catalog_deletion_requests_status" ON "catalog_deletion_requests"("status");

-- CreateIndex
CREATE INDEX "idx_catalog_deletion_requests_asset_definition" ON "catalog_deletion_requests"("asset_definition_id");

-- AddForeignKey
ALTER TABLE "catalog_deletion_requests" ADD CONSTRAINT "catalog_deletion_requests_asset_definition_id_fkey" FOREIGN KEY ("asset_definition_id") REFERENCES "asset_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_deletion_requests" ADD CONSTRAINT "catalog_deletion_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_deletion_requests" ADD CONSTRAINT "catalog_deletion_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_email_outbox_status" ON "email_outbox"("status");
