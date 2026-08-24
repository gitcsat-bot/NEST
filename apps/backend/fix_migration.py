import re

with open('prisma/migrations/20260817000000_phase1_features/migration.sql', 'r') as f:
    sql = f.read()

# Remove the incorrectly placed data migration
bad_insert = '''
-- Data Migration: materials -> inventory_items
INSERT INTO "inventory_items" ("id", "asset_definition_id", "location_id", "unit", "quantity_on_hand", "reorder_threshold", "created_at", "updated_at")
SELECT "id", "asset_definition_id", "location_id", 'pcs', "quantity_on_hand", "reorder_threshold", "created_at", "updated_at"
FROM "materials"
WHERE "location_id" IS NOT NULL;
'''
sql = sql.replace(bad_insert, '')

# Also fix the asset_definitions ALTER TABLE part to avoid DROP COLUMN sku
sql = re.sub(r'-- AlterTable\nALTER TABLE "asset_definitions" DROP COLUMN "is_consumable",\nDROP COLUMN "model_number",\nDROP COLUMN "requires_return",\nDROP COLUMN "sku",\nADD COLUMN     "category" VARCHAR\(100\) NOT NULL DEFAULT \'Uncategorized\',\nADD COLUMN     "datasheet_url" TEXT,\nADD COLUMN     "deleted_at" TIMESTAMPTZ,\nADD COLUMN     "part_number" VARCHAR\(50\) NOT NULL DEFAULT \'temp\';', 
'''-- AlterTable
ALTER TABLE "asset_definitions" DROP COLUMN "is_consumable",
DROP COLUMN "model_number",
DROP COLUMN "requires_return";
ALTER TABLE "asset_definitions" ADD COLUMN "category" VARCHAR(100) NOT NULL DEFAULT 'Uncategorized';
ALTER TABLE "asset_definitions" ADD COLUMN "datasheet_url" TEXT;
ALTER TABLE "asset_definitions" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "asset_definitions" RENAME COLUMN "sku" TO "part_number";''', sql)

# Add the data migration right before DROP TABLE "materials" which we will move to the END of the file
# Wait, materials are dropped at the beginning. We should move DROP TABLE "materials" to the end!
sql = sql.replace('-- DropTable\nDROP TABLE "materials";\n', '')

# Append to end of file
migration_append = '''
-- Data Migration: materials -> inventory_items
INSERT INTO "inventory_items" ("id", "asset_definition_id", "location_id", "unit", "quantity_on_hand", "reorder_threshold", "created_at", "updated_at")
SELECT "id", "asset_definition_id", "location_id", 'pcs', "quantity_on_hand", "reorder_threshold", "created_at", "updated_at"
FROM "materials"
WHERE "location_id" IS NOT NULL;

-- DropTable
DROP TABLE "materials";
'''
sql += migration_append

with open('prisma/migrations/20260817000000_phase1_features/migration.sql', 'w') as f:
    f.write(sql)
