"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Button, Field } from "@/components/ui/form";
import {
  discardUploadAction,
  startUploadAction,
  uploadBatchAction,
} from "@/lib/admin/photo-actions";
import { beginBusy, endBusy } from "@/lib/pwa/portal-lock";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { plural } from "@/lib/i18n/plural";

/**
 * While an upload is running, hold off the admin auto-lock so a long batch is
 * never interrupted by the idle timer.
 */
function useHoldLockWhileBusy(busy: boolean) {
  useEffect(() => {
    if (!busy) return;
    beginBusy();
    return endBusy;
  }, [busy]);
}

const selectClass =
  "w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink focus:border-leaf focus:outline-none";

const fileInputClass =
  "w-full rounded-xl border-2 border-dashed border-ink/20 bg-card px-4 py-6 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-leaf file:px-4 file:py-2 file:font-bold file:text-white";

/**
 * How much to put in one request.
 *
 * Server actions are capped (24 MB here), and a single request carrying two
 * hundred photos would be gigabytes regardless of the cap. So the browser sends
 * batches: files are accumulated until the next one would cross this budget,
 * then that batch goes as its own request. The number of photos a person can
 * select is therefore unlimited — only the size of one batch is bounded.
 *
 * Well under the server limit, since multipart encoding adds overhead and a
 * rejected request would lose the whole batch.
 */
const BATCH_BYTES = 8 * 1024 * 1024;

/** A single file larger than this is rejected server-side anyway. */
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type Rejection = { filename: string; reason: string };

function planBatches(files: File[]): File[][] {
  const batches: File[][] = [];
  let current: File[] = [];
  let currentBytes = 0;

  for (const file of files) {
    // A file at or over the batch budget travels alone; the server will reject
    // it if it is also over the per-file cap, and reporting that is better than
    // silently dropping it here.
    if (currentBytes + file.size > BATCH_BYTES && current.length > 0) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += file.size;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

function RejectedList({ rejected }: { rejected: Rejection[] }) {
  return (
    <Alert tone="error">
      <p className="mb-1">
        {rejected.length} file{rejected.length === 1 ? "" : "s"} could not be
        used:
      </p>
      <ul className="list-inside list-disc">
        {rejected.map((r, i) => (
          <li key={`${r.filename}-${i}`}>
            {r.filename} — {r.reason}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

type UploadStrings = Dictionary["admin"]["uploadForm"];

export function UploadForm({
  t,
  locale,
  classes,
}: {
  t: UploadStrings;
  locale: Locale;
  classes: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Rejection[]>([]);
  useHoldLockWhileBusy(busy);

  if (classes.length === 0) {
    return (
      <Alert tone="info">
        {t.noClass}
      </Alert>
    );
  }

  const oversized = files.filter((f) => f.size > MAX_FILE_BYTES);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const batchCount = planBatches(files).length;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (files.length === 0 || busy) return;

    setBusy(true);
    setError(null);
    setRejected([]);
    setUploaded(0);

    const started = await startUploadAction(classId);

    if (started.error || !started.uploadSessionId) {
      setError(started.error ?? t.couldNotStart);
      setBusy(false);
      return;
    }

    const sessionId = started.uploadSessionId;
    const allRejected: Rejection[] = [];
    let accepted = 0;

    for (const batch of planBatches(files)) {
      const body = new FormData();
      body.set("uploadSessionId", sessionId);
      for (const file of batch) body.append("photos", file);

      const result = await uploadBatchAction(body);

      if (result.error) {
        // Stop rather than hammering a server that is already refusing. Photos
        // already stored stay stored — the session is still usable.
        setError(
          `${result.error} ${accepted} photo${accepted === 1 ? "" : "s"} were uploaded before this happened.`,
        );
        setBusy(false);
        if (accepted > 0) router.push(`/admin/photos/${sessionId}`);
        return;
      }

      accepted += result.accepted;
      allRejected.push(...result.rejected);
      setUploaded((n) => n + batch.length);
    }

    if (accepted === 0) {
      // Nothing usable: clean up the empty session rather than leaving a ghost
      // entry in the uploads list.
      await discardUploadAction(sessionId);
      setError(t.noneUsable);
      setRejected(allRejected);
      setBusy(false);
      return;
    }

    router.push(`/admin/photos/${sessionId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {rejected.length > 0 ? <RejectedList rejected={rejected} /> : null}

      <Field label={t.classLabel} htmlFor="classId">
        <select
          id="classId"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          required
          className={selectClass}
          disabled={busy}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={t.photos}
        htmlFor="photos"
        hint={t.filesHint}
      >
        <input
          id="photos"
          name="photos"
          type="file"
          accept="image/*"
          multiple
          required
          disabled={busy}
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            setError(null);
            setRejected([]);
          }}
          className={fileInputClass}
        />
      </Field>

      {files.length > 0 && !busy ? (
        <p className="text-sm text-ink-soft">
          {files.length} photo{files.length === 1 ? "" : "s"} ·{" "}
          {(totalBytes / 1024 / 1024).toFixed(1)} MB
          {batchCount > 1 ? ` · sent in ${batchCount} batches` : ""}
        </p>
      ) : null}

      {oversized.length > 0 ? (
        <Alert tone="error">
          {oversized.length} file{oversized.length === 1 ? " is" : "s are"}{" "}
          larger than 15 MB and will be skipped:{" "}
          {oversized.map((f) => f.name).join(", ")}
        </Alert>
      ) : null}

      {busy ? (
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-paper-deep"
            role="progressbar"
            aria-valuenow={uploaded}
            aria-valuemin={0}
            aria-valuemax={files.length}
            aria-label={t.progress}
          >
            <div
              className="h-full rounded-full bg-leaf transition-[width]"
              style={{ width: `${(uploaded / files.length) * 100}%` }}
            />
          </div>
          <p aria-live="polite" className="mt-2 text-sm font-semibold text-ink-soft">
            Uploaded {uploaded} of {files.length}…
          </p>
        </div>
      ) : null}

      <Button type="submit" disabled={busy || files.length === 0}>
        {busy
          ? t.uploading
          : files.length === 0
            ? t.choosePhotosFirst
            : plural(t.uploadN, files.length, locale)}
      </Button>
    </form>
  );
}

/** Add more photos to an upload that has not been published yet. */
export function AddPhotosForm({
  uploadSessionId,
  t,
  locale,
}: {
  uploadSessionId: string;
  t: UploadStrings;
  locale: Locale;
}) {
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<Rejection[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  useHoldLockWhileBusy(busy);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (files.length === 0 || busy) return;

    setBusy(true);
    setError(null);
    setRejected([]);
    setSuccess(null);
    setUploaded(0);

    const allRejected: Rejection[] = [];
    let accepted = 0;

    for (const batch of planBatches(files)) {
      const body = new FormData();
      body.set("uploadSessionId", uploadSessionId);
      for (const file of batch) body.append("photos", file);

      const result = await uploadBatchAction(body);

      if (result.error) {
        setError(result.error);
        setBusy(false);
        router.refresh();
        return;
      }

      accepted += result.accepted;
      allRejected.push(...result.rejected);
      setUploaded((n) => n + batch.length);
    }

    setBusy(false);
    setFiles([]);
    setRejected(allRejected);
    setSuccess(
      accepted > 0
        ? plural(t.addedN, accepted, locale)
        : t.noneAdded,
    );
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {rejected.length > 0 ? <RejectedList rejected={rejected} /> : null}

      <label htmlFor="more-photos" className="block text-sm font-bold">
        Add more photos
      </label>
      <input
        id="more-photos"
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className={fileInputClass}
      />

      {busy ? (
        <p aria-live="polite" className="text-sm font-semibold text-ink-soft">
          Uploaded {uploaded} of {files.length}…
        </p>
      ) : null}

      <Button type="submit" disabled={busy || files.length === 0}>
        {busy
          ? t.uploading
          : files.length === 0
            ? t.choosePhotosFirst
            : plural(t.uploadN, files.length, locale)}
      </Button>
    </form>
  );
}
