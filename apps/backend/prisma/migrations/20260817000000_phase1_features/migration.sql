-- CreateEnum
CREATE TYPE "CatalogDeletionRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- DropForeignKey
ALTER TABLE "inventory_requests" DROP CONSTRAINT "inventory_requests_material_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_requests" DROP CONSTRAINT "inventory_requests_requested_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_requests" DROP CONSTRAINT "inventory_requests_reviewed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_asset_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_location_id_fkey";

-- DropIndex
DROP INDEX "asset_definitions_sku_key";

-- AlterTable
ALTER TABLE "asset_definitions" DROP COLUMN "is_consumable",
DROP COLUMN "model_number",
DROP COLUMN "requires_return";
ALTER TABLE "asset_definitions" ADD COLUMN "category" VARCHAR(100) NOT NULL DEFAULT 'Uncategorized';
ALTER TABLE "asset_definitions" ADD COLUMN "datasheet_url" TEXT;
ALTER TABLE "asset_definitions" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "asset_definitions" RENAME COLUMN "sku" TO "part_number";

-- AlterTable
ALTER TABLE "catalog_deletion_requests" DROP COLUMN "status",
ADD COLUMN     "status" "CatalogDeletionRequestStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "path_cache" ltree;

-- DropTable
DROP TABLE "inventory_requests";



-- DropEnum
DROP TYPE "InventoryRequestStatus";

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_code" TEXT NOT NULL,
    "asset_definition_id" UUID NOT NULL,
    "serial_number" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'registered',
    "current_location_id" UUID NOT NULL,
    "current_holder_user_id" UUID,
    "project_id" UUID,
    "condition_note" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "search_vector" tsvector,

    CONSTRAINT "asset_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_definition_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "reorder_threshold" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inventory_item_id" UUID NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reason" TEXT,
    "related_location_id" UUID,
    "project_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_instance_id" UUID NOT NULL,
    "held_by_user_id" UUID NOT NULL,
    "checked_out_by_user_id" UUID NOT NULL,
    "checked_out_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMPTZ,
    "checked_in_by_user_id" UUID,
    "condition_at_checkin" TEXT,
    "expected_return_at" TIMESTAMPTZ,

    CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "PolymorphicTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID NOT NULL,
    "moved_by_user_id" UUID NOT NULL,
    "moved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "movement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "PolymorphicTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reserved_for_user_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "quantity" INTEGER,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_asset_id" UUID NOT NULL,
    "child_asset_id" UUID NOT NULL,
    "relationship_type" "RelationshipType" NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "PolymorphicTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "declared_mime_type" TEXT NOT NULL,
    "detected_mime_type" TEXT,
    "size_bytes" BIGINT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'pending_scan',
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "asset_instances_display_code_key" ON "asset_instances"("display_code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_instances_serial_number_key" ON "asset_instances"("serial_number");

-- CreateIndex
CREATE INDEX "idx_asset_instances_status" ON "asset_instances"("status");

-- CreateIndex
CREATE INDEX "idx_asset_instances_location" ON "asset_instances"("current_location_id");

-- CreateIndex
CREATE INDEX "idx_asset_instances_holder" ON "asset_instances"("current_holder_user_id");

-- CreateIndex
CREATE INDEX "idx_asset_instances_definition" ON "asset_instances"("asset_definition_id");

-- CreateIndex
CREATE INDEX "asset_instances_search_vector_idx" ON "asset_instances" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "idx_inventory_items_location" ON "inventory_items"("location_id");

-- CreateIndex
CREATE INDEX "idx_inventory_items_def" ON "inventory_items"("asset_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_asset_definition_id_location_id_key" ON "inventory_items"("asset_definition_id", "location_id");

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_item" ON "inventory_transactions"("inventory_item_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_inventory_transactions_type" ON "inventory_transactions"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_checkouts_holder_open" ON "checkouts"("held_by_user_id");

-- CreateIndex
CREATE INDEX "idx_checkouts_asset_history" ON "checkouts"("asset_instance_id", "checked_out_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_checkouts_open_per_asset" ON "checkouts"("asset_instance_id");

-- CreateIndex
CREATE INDEX "idx_movement_events_target" ON "movement_events"("target_type", "target_id", "moved_at" DESC);

-- CreateIndex
CREATE INDEX "idx_reservations_target_active" ON "reservations"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_reservations_expiry" ON "reservations"("expires_at");

-- CreateIndex
CREATE INDEX "idx_relationships_parent" ON "asset_relationships"("parent_asset_id");

-- CreateIndex
CREATE INDEX "idx_relationships_child" ON "asset_relationships"("child_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_relationships_parent_asset_id_child_asset_id_relation_key" ON "asset_relationships"("parent_asset_id", "child_asset_id", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "idx_attachments_target" ON "attachments"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_attachments_status_pending" ON "attachments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_definitions_part_number_key" ON "asset_definitions"("part_number");

-- CreateIndex
CREATE INDEX "idx_asset_definitions_category" ON "asset_definitions"("category");

-- CreateIndex
CREATE INDEX "idx_asset_definitions_part_number" ON "asset_definitions"("part_number");

-- CreateIndex
CREATE INDEX "idx_catalog_deletion_requests_status" ON "catalog_deletion_requests"("status");

-- CreateIndex
CREATE INDEX "locations_path_cache_idx" ON "locations" USING GIST ("path_cache");

-- AddForeignKey
ALTER TABLE "asset_instances" ADD CONSTRAINT "asset_instances_asset_definition_id_fkey" FOREIGN KEY ("asset_definition_id") REFERENCES "asset_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_instances" ADD CONSTRAINT "asset_instances_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_instances" ADD CONSTRAINT "asset_instances_current_holder_user_id_fkey" FOREIGN KEY ("current_holder_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_instances" ADD CONSTRAINT "asset_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_instances" ADD CONSTRAINT "asset_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_instances" ADD CONSTRAINT "asset_instances_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_asset_definition_id_fkey" FOREIGN KEY ("asset_definition_id") REFERENCES "asset_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_related_location_id_fkey" FOREIGN KEY ("related_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_asset_instance_id_fkey" FOREIGN KEY ("asset_instance_id") REFERENCES "asset_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_held_by_user_id_fkey" FOREIGN KEY ("held_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_checked_out_by_user_id_fkey" FOREIGN KEY ("checked_out_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_checked_in_by_user_id_fkey" FOREIGN KEY ("checked_in_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_moved_by_user_id_fkey" FOREIGN KEY ("moved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reserved_for_user_id_fkey" FOREIGN KEY ("reserved_for_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "asset_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_child_asset_id_fkey" FOREIGN KEY ("child_asset_id") REFERENCES "asset_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Data Migration: materials -> inventory_items
INSERT INTO "inventory_items" ("id", "asset_definition_id", "location_id", "unit", "quantity_on_hand", "reorder_threshold", "created_at", "updated_at")
SELECT "id", "asset_definition_id", "location_id", 'pcs', "quantity_on_hand", "reorder_threshold", "created_at", "updated_at"
FROM "materials"
WHERE "location_id" IS NOT NULL;

-- DropTable
DROP TABLE "materials";
