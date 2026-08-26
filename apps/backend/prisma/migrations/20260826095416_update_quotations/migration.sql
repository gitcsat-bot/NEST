/*
  Warnings:

  - You are about to drop the column `title` on the `quotations` table. All the data in the column will be lost.
  - You are about to drop the column `vendor` on the `quotations` table. All the data in the column will be lost.
  - Added the required column `name` to the `quotations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tender_type` to the `quotations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "quotations" DROP COLUMN "title",
DROP COLUMN "vendor",
ADD COLUMN     "name" VARCHAR(200) NOT NULL,
ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "tender_type" VARCHAR(100) NOT NULL,
ADD COLUMN     "valid_till" TIMESTAMPTZ;
