-- CreateEnum
CREATE TYPE "InventoryRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_definition_id" UUID NOT NULL,
    "location_id" UUID,
    "status" "AssetStatus" NOT NULL DEFAULT 'registered',
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "reorder_threshold" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "requested_quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "InventoryRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_materials_status" ON "materials"("status");

-- CreateIndex
CREATE INDEX "idx_materials_asset_definition" ON "materials"("asset_definition_id");

-- CreateIndex
CREATE INDEX "idx_inventory_requests_status" ON "inventory_requests"("status");

-- CreateIndex
CREATE INDEX "idx_inventory_requests_material" ON "inventory_requests"("material_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_asset_definition_id_fkey" FOREIGN KEY ("asset_definition_id") REFERENCES "asset_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_requests" ADD CONSTRAINT "inventory_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
