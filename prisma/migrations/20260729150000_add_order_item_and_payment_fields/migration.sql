-- OrderItem: the line items of an order, snapshotted at checkout time.
-- unitPriceKopecks is a COPY of Walk.priceKopecks at checkout — a later admin
-- price edit must not change an in-flight order.
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "walkId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKopecks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- Index for the capacity query (seat-hold formula)
CREATE INDEX "OrderItem_walkId_idx" ON "OrderItem"("walkId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_walkId_fkey"
    FOREIGN KEY ("walkId") REFERENCES "Walk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitPriceKopecks_check" CHECK ("unitPriceKopecks" >= 0);

-- Order: end of the payment window (set at checkout to now + PAYMENT_HOLD_MINUTES),
-- settlement timestamp, and an admin-attention flag.
ALTER TABLE "Order" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "paymentIssue" TEXT;

-- Backfill any pre-existing rows before enforcing NOT NULL on expiresAt
UPDATE "Order" SET "expiresAt" = "createdAt" + INTERVAL '20 minutes' WHERE "expiresAt" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Index for the expiry sweep (lazy-on-read)
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");
