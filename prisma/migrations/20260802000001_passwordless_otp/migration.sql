-- USER accounts are passwordless from now on: they sign in with a one-time code
-- emailed to them. Only ADMIN/SUPERADMIN keep a password.

-- Irreversible: passwordHash becomes optional
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Null out dead credentials for every regular account
UPDATE "User" SET "passwordHash" = NULL WHERE "role" = 'USER';

-- PASSWORD_MIN_LENGTH rose from 8 to 16. bcrypt hashes are one-way, so we cannot
-- tell which existing admin passwords are long enough — force them all to rotate.
ALTER TABLE "User" ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "passwordResetRequired" = true WHERE "role" IN ('ADMIN', 'SUPERADMIN');

-- CreateTable
-- Keyed by email, not userId: no FK, so requesting a code costs the same amount of
-- work whether or not the account exists. codeHash is deliberately NOT unique —
-- the 6-character space makes collisions realistic, so every lookup matches
-- email AND codeHash together.
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginCode_email_idx" ON "LoginCode"("email");
