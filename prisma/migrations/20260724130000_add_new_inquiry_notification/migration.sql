-- AlterEnum
-- Additive: a new notification type so a website enquiry can reach the owner's
-- bell. Postgres 15 allows ADD VALUE inside the migration transaction because the
-- value is not used in the same transaction.
ALTER TYPE "NotificationType" ADD VALUE 'NEW_INQUIRY';
