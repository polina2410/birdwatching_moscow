-- AlterTable
ALTER TABLE "Walk" ADD COLUMN "galleryUrl" VARCHAR(2048);

-- AlterTable
ALTER TABLE "Expedition" ADD COLUMN "galleryUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
