/*
  Warnings:

  - The primary key for the `sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "session_id" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(64),
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");
