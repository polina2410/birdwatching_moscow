-- AdminLoginChallenge: short-lived token that bridges OTP verification and
-- password entry for ADMIN/SUPERADMIN accounts (2FA step 1 → step 2).
-- Keyed by email (not userId) to match the LoginCode pattern.
CREATE TABLE "AdminLoginChallenge" (
    "id"        TEXT          NOT NULL,
    "email"     VARCHAR(254)  NOT NULL,
    "tokenHash" VARCHAR(64)   NOT NULL,
    "expiresAt" TIMESTAMP(3)  NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminLoginChallenge_tokenHash_key" ON "AdminLoginChallenge"("tokenHash");
CREATE INDEX "AdminLoginChallenge_email_idx" ON "AdminLoginChallenge"("email");