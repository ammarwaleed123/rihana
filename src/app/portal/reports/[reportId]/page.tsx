import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/form";
import { NotFoundError } from "@/lib/auth/errors";
import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { requireParent } from "@/lib/auth/scope";
import { getReportForParent } from "@/lib/data/daily-reports";
import { getDictionary } from "@/lib/i18n";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/plural";

import { AcknowledgeButton } from "./acknowledge-button";

export const metadata: Metadata = {
  title: "Your child's day",
  robots: { index: false, follow: false },
};

const AREA_KEYS = {
  BLOCKS: "areaBlocks",
  DRAMATIC_PLAY: "areaDramaticPlay",
  ART: "areaArt",
  LIBRARY: "areaLibrary",
  DISCOVERY: "areaDiscovery",
  MOVEMENT: "areaMovement",
  COOKING: "areaCooking",
} as const;

export default async function PortalReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const session = await requireParent(`/portal/reports/${reportId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.reports;

  /*
   * A report outside this guardian's children is a 404, not a 403 — a 403 would
   * confirm the child is enrolled here, which is the disclosure the whole
   * scoping model exists to prevent. Same for a report still in draft.
   */
  let report;
  try {
    report = await getReportForParent(session, reportId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const dayFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const stampFormat = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const childName = report.child.firstName;
  const acknowledgedAt = report.acknowledgements[0]?.acknowledgedAt ?? null;

  if (report.status === "ABSENT") {
    return (
      <div>
        <BackLink label={t.title} />
        <PageHeader title={childName} description={dayFormat.format(report.date)} />
        <Alert tone="info">{fill(t.absentBody, { name: childName })}</Alert>
      </div>
    );
  }

  const meal = (name: "BREAKFAST" | "SNACK" | "LUNCH") =>
    report.meals.find((m) => m.meal === name);

  const amountLabel = (amount: "ALL" | "SOME" | "NOT_HUNGRY" | null) =>
    amount === "ALL"
      ? t.amountAll
      : amount === "SOME"
        ? t.amountSome
        : amount === "NOT_HUNGRY"
          ? t.amountNotHungry
          : "—";

  return (
    <div className="space-y-4 pb-8">
      <BackLink label={t.title} />
      <PageHeader title={childName} description={dayFormat.format(report.date)} />

      {report.lastEditedAt ? (
        <Alert tone="info">
          {fill(t.updatedNotice, { date: stampFormat.format(report.lastEditedAt) })}
        </Alert>
      ) : null}

      {report.arrivalTime ? (
        <Card>
          <p className="text-ink">
            <span className="font-bold">{t.arrivalTime}</span>{" "}
            <span dir="ltr">{report.arrivalTime}</span>
          </p>
        </Card>
      ) : null}

      {report.playAreas.length > 0 || report.alsoEnjoyed ? (
        <Card>
          <SectionTitle>{t.playedIn}</SectionTitle>
          <ul className="mt-2 flex flex-wrap gap-2">
            {report.playAreas.map((area) => (
              <li
                key={area}
                className="rounded-full bg-leaf-soft px-3 py-1 text-sm font-semibold text-leaf-dark"
              >
                {t[AREA_KEYS[area as keyof typeof AREA_KEYS]]}
              </li>
            ))}
          </ul>
          {report.alsoEnjoyed ? (
            <p className="mt-3 text-ink" dir="auto">
              <span className="font-bold">{t.alsoEnjoyed}:</span> {report.alsoEnjoyed}
            </p>
          ) : null}
        </Card>
      ) : null}

      {report.quranMemorised || report.quranRevision || report.littleMuslim ? (
        <Card>
          <div dir="rtl" className="text-start">
            <SectionTitle>{t.quran}</SectionTitle>
            <dl className="mt-2 space-y-1">
              {report.quranMemorised ? (
                <div className="flex gap-2">
                  <dt className="font-bold">{t.quranMemorised}:</dt>
                  <dd dir="auto">{report.quranMemorised}</dd>
                </div>
              ) : null}
              {report.quranRevision ? (
                <div className="flex gap-2">
                  <dt className="font-bold">{t.quranRevision}:</dt>
                  <dd dir="auto">{report.quranRevision}</dd>
                </div>
              ) : null}
            </dl>

            {report.littleMuslim ? (
              <div className="mt-3">
                <p className="font-bold">{t.littleMuslim}</p>
                <p dir="auto">{report.littleMuslim}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {report.meals.length > 0 ? (
        <Card>
          <SectionTitle>{t.ate}</SectionTitle>
          <ul className="mt-2 space-y-2">
            {(["BREAKFAST", "SNACK", "LUNCH"] as const).map((name) => {
              const row = meal(name);
              if (!row) return null;
              const label =
                name === "BREAKFAST"
                  ? t.mealBreakfast
                  : name === "SNACK"
                    ? t.mealSnack
                    : t.mealLunch;
              return (
                <li key={name} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-bold text-ink">{label}:</span>
                  <span className="text-ink">{amountLabel(row.amount)}</span>
                  {row.description ? (
                    <span className="text-ink-soft" dir="auto">
                      — {row.description}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t.toilet}</SectionTitle>
        {report.toiletNothingToRecord || report.toiletEntries.length === 0 ? (
          <p className="mt-2 text-ink-soft">{t.toiletNothing}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {report.toiletEntries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-2">
                <span className="font-bold text-ink" dir="ltr">
                  {entry.time}
                </span>
                {entry.wet ? <Tag>{t.toiletWet}</Tag> : null}
                {entry.bm ? <Tag>{t.toiletBm}</Tag> : null}
                {entry.accident ? <Tag>{t.toiletAccident}</Tag> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>{t.nap}</SectionTitle>
        <p className="mt-2 text-ink">
          {report.napNone
            ? t.napNone
            : report.napFrom && report.napUntil
              ? fill(t.napBetween, { from: report.napFrom, until: report.napUntil })
              : "—"}
        </p>
      </Card>

      {report.bringCleanClothes || report.bringDiapers || report.bringOther ? (
        <Card>
          <SectionTitle>{t.bring}</SectionTitle>
          <ul className="mt-2 list-inside list-disc text-ink">
            {report.bringCleanClothes ? <li>{t.bringCleanClothes}</li> : null}
            {report.bringDiapers ? <li>{t.bringDiapers}</li> : null}
            {report.bringOther ? <li dir="auto">{report.bringOther}</li> : null}
          </ul>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{t.teacherComments}</SectionTitle>
        <p className="mt-2 text-ink" dir="auto">
          {report.teacherComments || t.noComment}
        </p>
      </Card>

      <AcknowledgeButton
        reportId={report.id}
        acknowledgedAt={
          acknowledgedAt ? stampFormat.format(acknowledgedAt) : null
        }
        t={{
          acknowledge: t.acknowledge,
          acknowledging: t.acknowledging,
          acknowledged: t.acknowledged,
        }}
      />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sky-soft px-2.5 py-0.5 text-xs font-bold text-ink">
      {children}
    </span>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <p>
      <Link
        href="/portal/reports"
        className="text-sm font-bold text-ink-soft hover:text-leaf"
      >
        ← {label}
      </Link>
    </p>
  );
}
