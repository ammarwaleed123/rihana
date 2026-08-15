import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/form";
import { Card, PageHeader, SectionTitle } from "@/components/ui/shell";
import { NotFoundError } from "@/lib/auth/errors";
import { requireParent } from "@/lib/auth/scope";
import { getAccidentReportForParent } from "@/lib/data/accident-reports";
import { acknowledgementIsStale } from "@/lib/data/accident-rules";
import { getDictionary } from "@/lib/i18n";
import {
  natureLabel,
  partLabel,
  placeLabel,
  treatmentLabel,
} from "@/lib/i18n/accident-labels";
import { getAppLocale } from "@/lib/i18n/app-locale";
import { LOCALE_INTL } from "@/lib/i18n/config";
import { fill, joinList } from "@/lib/i18n/plural";
import type {
  ACCIDENT_PLACES,
  BODY_PARTS,
  INJURY_NATURES,
  INJURY_TREATMENTS,
} from "@/lib/validation";

import { SignIncident } from "./sign-incident";

export const metadata: Metadata = {
  title: "Accident report",
  robots: { index: false, follow: false },
};

/**
 * One day's accidents, as a family reads them.
 *
 * Written in the past tense and without the form's vocabulary — a parent is
 * being told what happened to their child. The only thing they do here is sign,
 * and that is the only control on the page.
 */
export default async function PortalAccidentPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const session = await requireParent(`/portal/accidents/${reportId}`);
  const locale = await getAppLocale();
  const dict = await getDictionary(locale);
  const t = dict.portal.accidents;

  /*
   * A record outside this guardian's children is a 404, not a 403 — a 403 would
   * confirm the child is enrolled here. Same for a day a teacher opened and
   * never wrote on.
   */
  let report;
  try {
    report = await getAccidentReportForParent(session, reportId);
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

  return (
    <div className="space-y-4 pb-8">
      <p>
        <Link
          href="/portal/accidents"
          className="text-sm font-bold text-ink-soft hover:text-leaf"
        >
          ← {t.title}
        </Link>
      </p>

      <PageHeader
        title={report.child.firstName}
        description={dayFormat.format(report.date)}
      />

      {report.incidents.map((incident) => {
        const mine = incident.acknowledgements[0] ?? null;
        const stale = acknowledgementIsStale(
          mine?.acknowledgedAt,
          incident.updatedAt,
        );
        const signedLabel =
          mine && !stale
            ? fill(t.signed, {
                date: stampFormat.format(mine.acknowledgedAt),
              })
            : null;

        return (
          <Card key={incident.id}>
            <SectionTitle>
              {fill(t.timeOfIncident, { time: incident.timeOfIncident })}
            </SectionTitle>

            {stale ? (
              <div className="mt-2">
                <Alert tone="info">
                  {fill(t.correctedNotice, {
                    date: stampFormat.format(incident.updatedAt),
                  })}
                </Alert>
              </div>
            ) : null}

            <dl className="mt-3 space-y-2 text-ink">
              <Row
                label={t.place}
                value={
                  incident.place === "OTHER" && incident.placeOther
                    ? incident.placeOther
                    : placeLabel(
                        t,
                        incident.place as (typeof ACCIDENT_PLACES)[number],
                      )
                }
              />
              {/*
               * `joinList` rather than a hardcoded separator: English wants
               * "Knee, Hand and Foot" and Arabic wants "الركبة واليد والقدم",
               * and any single character gets one of the two wrong.
               */}
              <Row
                label={t.bodyParts}
                value={joinList(
                  incident.bodyParts.map((part) =>
                    partLabel(t, part as (typeof BODY_PARTS)[number]),
                  ),
                  locale,
                )}
              />
              <Row
                label={t.nature}
                value={joinList(
                  [
                    ...incident.nature.map((value) =>
                      natureLabel(t, value as (typeof INJURY_NATURES)[number]),
                    ),
                    ...(incident.natureOther ? [incident.natureOther] : []),
                  ],
                  locale,
                )}
              />
              <Row
                label={t.treatment}
                value={joinList(
                  [
                    ...incident.treatment.map((value) =>
                      treatmentLabel(
                        t,
                        value as (typeof INJURY_TREATMENTS)[number],
                      ),
                    ),
                    ...(incident.treatmentOther
                      ? [incident.treatmentOther]
                      : []),
                  ],
                  locale,
                )}
              />
            </dl>

            <div className="mt-3">
              <p className="font-bold text-ink">{t.whatHappened}</p>
              <p className="mt-1 whitespace-pre-line text-ink" dir="auto">
                {incident.description}
              </p>
            </div>

            <div className="mt-3">
              <p className="font-bold text-ink">{t.notified}</p>
              {incident.parentsNotified || incident.doctorNotified ? (
                <ul className="mt-1 list-inside list-disc text-ink">
                  {incident.parentsNotified ? (
                    <li>
                      {fill(t.parentsNotified, {
                        time: incident.notificationTime ?? "—",
                      })}
                    </li>
                  ) : null}
                  {incident.doctorNotified ? (
                    <li>
                      {fill(t.doctorNotified, {
                        time: incident.notificationTime ?? "—",
                      })}
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="mt-1 text-ink-soft">{t.nobodyCalled}</p>
              )}
            </div>

            <div className="mt-4 border-t-2 border-ink/10 pt-3">
              <p className="text-sm font-semibold text-ink-soft">
                {fill(t.teacherSignature, {
                  name: incident.signedBy?.name ?? "—",
                })}
              </p>
              {/*
               * Through the authorized image route, never a storage URL.
               * `unoptimized` because that route answers with a 302 to a
               * short-lived signed URL, which the image optimizer cannot cache.
               */}
              <Image
                src={`/api/img/signature/incident/${incident.id}`}
                alt=""
                width={300}
                height={100}
                unoptimized
                className="mt-2 h-auto w-full max-w-[300px] rounded-lg border-2 border-ink/10 bg-white"
              />
            </div>

            <div className="mt-4">
              <SignIncident
                incidentId={incident.id}
                signedAt={signedLabel}
                t={{
                  signature: t.signature,
                  signatureHint: t.signatureHint,
                  signatureEmpty: t.signatureEmpty,
                  signatureClear: t.signatureClear,
                  sign: t.sign,
                  signing: t.signing,
                  signed: t.signed,
                }}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="font-bold">{label}:</dt>
      <dd dir="auto">{value}</dd>
    </div>
  );
}
