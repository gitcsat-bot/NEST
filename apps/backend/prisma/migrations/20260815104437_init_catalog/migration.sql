-- CreateTable
CREATE TABLE "asset_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "manufacturer" VARCHAR(100),
    "model_number" VARCHAR(100),
    "is_consumable" BOOLEAN NOT NULL DEFAULT false,
    "requires_return" BOOLEAN NOT NULL DEFAULT false,
    "search_vector" tsvector,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "asset_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_definitions_sku_key" ON "asset_definitions"("sku");

-- CreateIndex
CREATE INDEX "asset_definitions_search_vector_idx" ON "asset_definitions" USING GIN ("search_vector");
