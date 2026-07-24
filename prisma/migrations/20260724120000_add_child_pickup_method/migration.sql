-- CreateEnum
CREATE TYPE "PickupMethod" AS ENUM ('HANDOVER', 'BUS');

-- AlterTable
-- Additive and safe on a populated table: every existing child defaults to
-- HANDOVER (collected at the door), which is the pre-existing behaviour.
ALTER TABLE "children" ADD COLUMN     "pickupMethod" "PickupMethod" NOT NULL DEFAULT 'HANDOVER';
