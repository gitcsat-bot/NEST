-- AlterTable
ALTER TABLE "asset_definitions" ADD COLUMN     "is_consumable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model_number" VARCHAR(100),
ADD COLUMN     "requires_return" BOOLEAN NOT NULL DEFAULT false;
