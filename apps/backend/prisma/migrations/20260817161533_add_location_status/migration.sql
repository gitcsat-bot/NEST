-- CreateEnum
CREATE TYPE "location_statuses" AS ENUM ('open', 'closed', 'locked');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "status" "location_statuses" NOT NULL DEFAULT 'open';
