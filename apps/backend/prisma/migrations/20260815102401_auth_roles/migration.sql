-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'student';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pending_role" "UserRole";
