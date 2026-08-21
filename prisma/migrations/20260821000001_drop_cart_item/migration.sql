-- Cart is removed: users now select a walk and quantity and pay immediately.
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_userId_fkey";
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_walkId_fkey";
DROP INDEX "CartItem_reservedUntil_idx";
DROP TABLE "CartItem";
