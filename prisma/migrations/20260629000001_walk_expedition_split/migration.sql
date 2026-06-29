-- Split Event into Walk and Expedition.
-- This migration cannot be auto-generated; it copies rows between tables.
-- Prisma wraps each migration in a transaction automatically, so any failure
-- rolls back the entire operation and leaves Event intact.

-- CreateTable: Walk (ticketed; single guide via FK)
CREATE TABLE "Walk" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "priceKopecks" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "guideId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "coverPhotoUrl" VARCHAR(2048) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Walk_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Expedition (spot-based; multiple guides via M2M)
CREATE TABLE "Expedition" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "totalSpots" INTEGER NOT NULL,
    "spotsLeft" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "coverPhotoUrl" VARCHAR(2048) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Expedition-TeamMember M2M join table
-- "Expedition" < "TeamMember" alphabetically → A = Expedition.id, B = TeamMember.id
CREATE TABLE "_ExpeditionToTeamMember" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExpeditionToTeamMember_AB_pkey" PRIMARY KEY ("A","B")
);

-- Indexes
CREATE UNIQUE INDEX "Walk_slug_key" ON "Walk"("slug");
CREATE INDEX "Walk_status_startsAt_idx" ON "Walk"("status", "startsAt");
CREATE UNIQUE INDEX "Expedition_slug_key" ON "Expedition"("slug");
CREATE INDEX "Expedition_status_startsAt_idx" ON "Expedition"("status", "startsAt");
CREATE INDEX "_ExpeditionToTeamMember_B_index" ON "_ExpeditionToTeamMember"("B");

-- Check constraints
ALTER TABLE "Walk"       ADD CONSTRAINT "Walk_priceKopecks_check" CHECK ("priceKopecks" >= 0);
ALTER TABLE "Walk"       ADD CONSTRAINT "Walk_capacity_check"      CHECK ("capacity" >= 1);
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_totalSpots_check" CHECK ("totalSpots" >= 1);
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_spotsLeft_check"  CHECK ("spotsLeft" >= 0);

-- FK constraints on Walk and Expedition
ALTER TABLE "Walk" ADD CONSTRAINT "Walk_guideId_fkey"
    FOREIGN KEY ("guideId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Walk" ADD CONSTRAINT "Walk_publishedBy_fkey"
    FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_publishedBy_fkey"
    FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_ExpeditionToTeamMember" ADD CONSTRAINT "_ExpeditionToTeamMember_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Expedition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ExpeditionToTeamMember" ADD CONSTRAINT "_ExpeditionToTeamMember_B_fkey"
    FOREIGN KEY ("B") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy WALK rows from Event into Walk.
-- guideId is populated from _EventToTeamMember using the lexicographically smallest
-- teamMemberId per event (deterministic). Prerequisite: every WALK event must have
-- at least one row in _EventToTeamMember or this INSERT will fail the NOT NULL constraint.
INSERT INTO "Walk" ("id", "slug", "title", "description", "startsAt", "location",
                    "priceKopecks", "capacity", "guideId", "status", "coverPhotoUrl",
                    "publishedAt", "publishedBy", "createdAt")
SELECT
    e."id",
    e."slug",
    e."title",
    e."description",
    e."startsAt",
    e."location",
    e."priceKopecks",
    e."capacity",
    (SELECT "B" FROM "_EventToTeamMember" WHERE "A" = e."id" ORDER BY "B" LIMIT 1),
    e."status",
    e."coverPhotoUrl",
    e."publishedAt",
    e."publishedBy",
    e."createdAt"
FROM "Event" e
WHERE e."type" = 'WALK';

-- Copy EXPEDITION rows from Event into Expedition.
INSERT INTO "Expedition" ("id", "slug", "title", "description", "startsAt", "location",
                          "totalSpots", "spotsLeft", "status", "coverPhotoUrl",
                          "publishedAt", "publishedBy", "createdAt")
SELECT
    e."id",
    e."slug",
    e."title",
    e."description",
    e."startsAt",
    e."location",
    e."totalSpots",
    e."spotsLeft",
    e."status",
    e."coverPhotoUrl",
    e."publishedAt",
    e."publishedBy",
    e."createdAt"
FROM "Event" e
WHERE e."type" = 'EXPEDITION';

-- Copy guides for expeditions from the old join table into the new one.
INSERT INTO "_ExpeditionToTeamMember" ("A", "B")
SELECT etm."A", etm."B"
FROM "_EventToTeamMember" etm
INNER JOIN "Event" e ON etm."A" = e."id"
WHERE e."type" = 'EXPEDITION';

-- ExpeditionDay FK rename: eventId → expeditionId
ALTER TABLE "ExpeditionDay" ADD COLUMN "expeditionId" TEXT;
UPDATE "ExpeditionDay" ed
    SET "expeditionId" = ed."eventId";
ALTER TABLE "ExpeditionDay" ALTER COLUMN "expeditionId" SET NOT NULL;
ALTER TABLE "ExpeditionDay" DROP CONSTRAINT "ExpeditionDay_eventId_fkey";
ALTER TABLE "ExpeditionDay" DROP COLUMN "eventId";
ALTER TABLE "ExpeditionDay" ADD CONSTRAINT "ExpeditionDay_expeditionId_fkey"
    FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ticket FK rename: eventId → walkId
ALTER TABLE "Ticket" ADD COLUMN "walkId" TEXT;
UPDATE "Ticket" t SET "walkId" = t."eventId";
ALTER TABLE "Ticket" ALTER COLUMN "walkId" SET NOT NULL;
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_eventId_fkey";
ALTER TABLE "Ticket" DROP COLUMN "eventId";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_walkId_fkey"
    FOREIGN KEY ("walkId") REFERENCES "Walk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CartItem FK rename: eventId → walkId
ALTER TABLE "CartItem" ADD COLUMN "walkId" TEXT;
UPDATE "CartItem" ci SET "walkId" = ci."eventId";
ALTER TABLE "CartItem" ALTER COLUMN "walkId" SET NOT NULL;
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_eventId_fkey";
ALTER TABLE "CartItem" DROP COLUMN "eventId";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_walkId_fkey"
    FOREIGN KEY ("walkId") REFERENCES "Walk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Request FK rename: eventId → expeditionId (null for PRIVATE_WALK rows)
ALTER TABLE "Request" ADD COLUMN "expeditionId" TEXT;
UPDATE "Request" r SET "expeditionId" = r."eventId" WHERE r."type" = 'EXPEDITION';
ALTER TABLE "Request" DROP CONSTRAINT "Request_eventId_fkey";
ALTER TABLE "Request" DROP COLUMN "eventId";
ALTER TABLE "Request" ADD CONSTRAINT "Request_expeditionId_fkey"
    FOREIGN KEY ("expeditionId") REFERENCES "Expedition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the old Event infrastructure
DROP TABLE "_EventToTeamMember";
DROP TABLE "Event";
DROP TYPE "EventType";
