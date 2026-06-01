/*
  Warnings:

  - You are about to drop the column `firstName` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Request` table. All the data in the column will be lost.
  - Added the required column `name` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "status",
ADD COLUMN     "name" VARCHAR(100) NOT NULL;

-- DropEnum
DROP TYPE "RequestStatus";
