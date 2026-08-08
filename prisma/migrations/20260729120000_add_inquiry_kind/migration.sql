-- CreateEnum
CREATE TYPE "InquiryKind" AS ENUM ('VISIT', 'QUESTION');

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "kind" "InquiryKind" NOT NULL DEFAULT 'QUESTION',
ADD COLUMN     "preferredVisit" TEXT;
