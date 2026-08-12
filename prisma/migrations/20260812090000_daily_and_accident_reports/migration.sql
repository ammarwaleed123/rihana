-- Daily reports and accident reports.
--
-- Digitises two paper forms the nursery already uses: the notebook that goes
-- home with each child every day, and the accident report. Both are scoped
-- exactly like photos — a teacher writes only for their assigned class, a
-- guardian reads only their own child.
--
-- Additive only: seven new tables, nine new enums, five new notification types.
-- Nothing existing is altered or dropped.
--
-- The RLS block at the end is not optional. `20260720005455_lock_down_public_api_roles`
-- set up two defences against Supabase's public API roles — REVOKE and
-- deny-by-default row-level security — but only the REVOKE half carries forward
-- to new tables, via ALTER DEFAULT PRIVILEGES. Postgres has no equivalent
-- default for RLS, which is how `push_subscriptions` arrived half-protected and
-- needed `20260809180000_rls_for_later_tables` to catch up. `scripts/check-rls.ts`
-- now fails on any RLS-off table, so forgetting this would break the build
-- rather than quietly leave a door open.

-- CreateEnum
CREATE TYPE "DailyReportStatus" AS ENUM ('DRAFT', 'ABSENT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PlayArea" AS ENUM ('BLOCKS', 'DRAMATIC_PLAY', 'ART', 'LIBRARY', 'DISCOVERY', 'MOVEMENT', 'COOKING');

-- CreateEnum
CREATE TYPE "Meal" AS ENUM ('BREAKFAST', 'SNACK', 'LUNCH');

-- CreateEnum
CREATE TYPE "MealAmount" AS ENUM ('ALL', 'SOME', 'NOT_HUNGRY');

-- CreateEnum
CREATE TYPE "AccidentPlace" AS ENUM ('MONTESSORI_CLASS', 'ART_CLASS', 'TOILET', 'GARDEN', 'DRAMA_CLASS', 'ACADEMIC_CLASS', 'OTHER');

-- CreateEnum
CREATE TYPE "BodyFigure" AS ENUM ('BOY', 'GIRL');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('FOREHEAD', 'EYEBROW', 'EYE', 'EAR', 'CHEEK', 'NOSE', 'MOUTH', 'LIP', 'TOOTH', 'TONGUE', 'CHIN', 'NECK', 'CHEST', 'ARM', 'HAND', 'STOMACH', 'KNEE', 'LEG', 'FOOT', 'TOE');

-- CreateEnum
CREATE TYPE "InjuryNature" AS ENUM ('BITE', 'SCRATCH', 'ANKLE_SPRAIN', 'RED_MARK', 'BRUISES', 'CUT', 'HITTING', 'SCRATCH_ARTIFICIAL_GRASS', 'OTHER');

-- CreateEnum
CREATE TYPE "InjuryTreatment" AS ENUM ('ICE', 'BETADINE', 'RUNNING_WATER', 'BANDAGE', 'HEMOCLAR', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DAILY_REPORT_READY';
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_REPORT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'CHILD_ABSENT';
ALTER TYPE "NotificationType" ADD VALUE 'ACCIDENT_REPORTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPORT_ACKNOWLEDGED';

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DailyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "classId" TEXT,
    "arrivalTime" TEXT,
    "playAreas" "PlayArea"[],
    "alsoEnjoyed" TEXT,
    "quranMemorised" TEXT,
    "quranRevision" TEXT,
    "littleMuslim" TEXT,
    "napNone" BOOLEAN NOT NULL DEFAULT false,
    "napFrom" TEXT,
    "napUntil" TEXT,
    "toiletNothingToRecord" BOOLEAN NOT NULL DEFAULT false,
    "bringCleanClothes" BOOLEAN NOT NULL DEFAULT false,
    "bringDiapers" BOOLEAN NOT NULL DEFAULT false,
    "bringOther" TEXT,
    "teacherComments" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "lastEditedAt" TIMESTAMP(3),
    "lastEditedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_meals" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "meal" "Meal" NOT NULL,
    "amount" "MealAmount" NOT NULL,
    "description" TEXT,

    CONSTRAINT "daily_report_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_toilet_entries" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "wet" BOOLEAN NOT NULL DEFAULT false,
    "bm" BOOLEAN NOT NULL DEFAULT false,
    "accident" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "daily_report_toilet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_report_acknowledgements" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_report_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accident_reports" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accident_incidents" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "timeOfIncident" TEXT NOT NULL,
    "place" "AccidentPlace" NOT NULL,
    "placeOther" TEXT,
    "figure" "BodyFigure" NOT NULL,
    "bodyParts" "BodyPart"[],
    "nature" "InjuryNature"[],
    "natureOther" TEXT,
    "treatment" "InjuryTreatment"[],
    "treatmentOther" TEXT,
    "description" TEXT NOT NULL,
    "parentsNotified" BOOLEAN NOT NULL DEFAULT false,
    "doctorNotified" BOOLEAN NOT NULL DEFAULT false,
    "notificationTime" TEXT,
    "signatureStorageKey" TEXT NOT NULL,
    "signedByUserId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accident_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accident_acknowledgements" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signatureStorageKey" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accident_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_reports_childId_date_idx" ON "daily_reports"("childId", "date" DESC);

-- CreateIndex
CREATE INDEX "daily_reports_classId_date_status_idx" ON "daily_reports"("classId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_childId_date_key" ON "daily_reports"("childId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_meals_reportId_meal_key" ON "daily_report_meals"("reportId", "meal");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_toilet_entries_reportId_position_key" ON "daily_report_toilet_entries"("reportId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "daily_report_acknowledgements_reportId_userId_key" ON "daily_report_acknowledgements"("reportId", "userId");

-- CreateIndex
CREATE INDEX "accident_reports_childId_date_idx" ON "accident_reports"("childId", "date" DESC);

-- CreateIndex
CREATE INDEX "accident_reports_classId_date_idx" ON "accident_reports"("classId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "accident_reports_childId_date_key" ON "accident_reports"("childId", "date");

-- CreateIndex
CREATE INDEX "accident_incidents_reportId_timeOfIncident_idx" ON "accident_incidents"("reportId", "timeOfIncident");

-- CreateIndex
CREATE UNIQUE INDEX "accident_acknowledgements_incidentId_userId_key" ON "accident_acknowledgements"("incidentId", "userId");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_meals" ADD CONSTRAINT "daily_report_meals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_toilet_entries" ADD CONSTRAINT "daily_report_toilet_entries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_acknowledgements" ADD CONSTRAINT "daily_report_acknowledgements_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_report_acknowledgements" ADD CONSTRAINT "daily_report_acknowledgements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_reports" ADD CONSTRAINT "accident_reports_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_reports" ADD CONSTRAINT "accident_reports_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_incidents" ADD CONSTRAINT "accident_incidents_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "accident_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_incidents" ADD CONSTRAINT "accident_incidents_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_acknowledgements" ADD CONSTRAINT "accident_acknowledgements_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "accident_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accident_acknowledgements" ADD CONSTRAINT "accident_acknowledgements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Deny-by-default row-level security on the new tables.
--
-- The application connects as the table owner, which bypasses RLS, so this
-- costs the app nothing. FORCE ROW LEVEL SECURITY is deliberately NOT used —
-- it would constrain the owner too and break every query.
--
-- Enumerated dynamically so a table added above cannot be missed here.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      target.relname
    );
  END LOOP;
END
$$;
