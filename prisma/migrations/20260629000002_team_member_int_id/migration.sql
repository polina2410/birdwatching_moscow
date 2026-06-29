-- Change TeamMember.id from UUID (TEXT) to SERIAL (INT).
-- This is a dev-only change: truncate all rows that reference TeamMember,
-- retype the columns, then re-add FK constraints.

-- 1. Clear dependent rows (all in one statement so PostgreSQL handles FK checks as a unit)
TRUNCATE TABLE "CartItem", "Ticket", "Walk", "_ExpeditionToTeamMember", "TeamMember";

-- 2. Drop FK constraints that reference TeamMember.id
ALTER TABLE "Walk" DROP CONSTRAINT "Walk_guideId_fkey";
ALTER TABLE "_ExpeditionToTeamMember" DROP CONSTRAINT "_ExpeditionToTeamMember_B_fkey";

-- 3. Swap TeamMember.id to SERIAL
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_pkey";
ALTER TABLE "TeamMember" DROP COLUMN "id";
ALTER TABLE "TeamMember" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id");

-- 4. Retype Walk.guideId TEXT → INTEGER (table is empty so no USING cast needed)
ALTER TABLE "Walk" ALTER COLUMN "guideId" TYPE INTEGER USING "guideId"::INTEGER;

-- 5. Retype _ExpeditionToTeamMember.B TEXT → INTEGER
ALTER TABLE "_ExpeditionToTeamMember" DROP CONSTRAINT "_ExpeditionToTeamMember_AB_pkey";
ALTER TABLE "_ExpeditionToTeamMember" ALTER COLUMN "B" TYPE INTEGER USING "B"::INTEGER;
ALTER TABLE "_ExpeditionToTeamMember" ADD CONSTRAINT "_ExpeditionToTeamMember_AB_pkey" PRIMARY KEY ("A", "B");

-- 6. Re-add FK constraints
ALTER TABLE "Walk" ADD CONSTRAINT "Walk_guideId_fkey"
    FOREIGN KEY ("guideId") REFERENCES "TeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "_ExpeditionToTeamMember" ADD CONSTRAINT "_ExpeditionToTeamMember_B_fkey"
    FOREIGN KEY ("B") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
