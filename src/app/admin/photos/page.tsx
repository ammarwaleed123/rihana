import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/ui/shell";
import { requireStaff } from "@/lib/auth/scope";
import { listClassesForSession } from "@/lib/data/classes";
import { listUploadSessions } from "@/lib/data/photos";

import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

export default async function PhotosPage() {
  const session = await requireStaff("/admin/photos");

  // Both scoped: a teacher uploads into, and sees uploads for, their own
  // classes only.
  const [classes, uploads] = await Promise.all([
    listClassesForSession(session),
    listUploadSessions(session),
  ]);

  return (
    <div>
      <AdminNav current="/admin/photos" role={session.user.role} />

      <PageHeader
        title="Photos"
        description="Upload photos, tag who is in them, then publish to families."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <SectionTitle>New upload</SectionTitle>
          <UploadForm classes={classes} />
        </Card>

        <div>
          <SectionTitle>Recent uploads</SectionTitle>

          {uploads.length === 0 ? (
            <EmptyState
              title="No uploads yet"
              description="Upload your first batch of photos and tag who appears in each one."
            />
          ) : (
            <ul className="space-y-3">
              {uploads.map((upload) => {
                const published = upload.status === "PUBLISHED";

                return (
                  <li
                    key={upload.id}
                    className="rounded-2xl border border-ink/10 bg-card p-4 shadow-pin"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold">
                          {upload.class?.name ?? "No class"}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {upload._count.photos} photo
                          {upload._count.photos === 1 ? "" : "s"} ·{" "}
                          {upload.uploader.name} ·{" "}
                          {upload.createdAt.toISOString().slice(0, 10)}
                        </p>
                      </div>

                      {published ? (
                        <Badge tone="green">Published</Badge>
                      ) : (
                        <Badge tone="yellow">Not published</Badge>
                      )}
                    </div>

                    <p className="mt-3">
                      <Link
                        href={`/admin/photos/${upload.id}`}
                        className="font-semibold text-leaf underline underline-offset-4"
                      >
                        {published ? "View photos" : "Tag and publish"}
                      </Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
