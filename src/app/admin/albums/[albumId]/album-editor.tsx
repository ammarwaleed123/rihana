"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import {
  addPhotosAction,
  deleteAlbumAction,
  publishAlbumAction,
  removePhotoAction,
  setCoverAction,
  unpublishAlbumAction,
  type AlbumFormState,
} from "@/lib/admin/album-actions";
import { cn } from "@/lib/cn";
import { LOCALE_INTL, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { fill, plural } from "@/lib/i18n/plural";

type T = Dictionary["admin"]["albumEditor"];

type AvailablePhoto = { id: string; caption: string | null; createdAt: Date };

function Pending({ label, pendingLabel, ...rest }: {
  label: string;
  pendingLabel: string;
} & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Pick photos to add.
 *
 * Selection is client state and the ticked ids post as `photoIds`. The server
 * re-checks every one against the caller's own scope, so a tampered form adds
 * nothing rather than reaching into another class — the count in the response
 * is what tells staff that happened.
 */
export function AddPhotosPicker({
  albumId,
  photos,
  nextCursor,
  t,
  locale,
}: {
  albumId: string;
  photos: AvailablePhoto[];
  nextCursor: string | null;
  t: T;
  locale: Locale;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    addPhotosAction,
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Built per render rather than at module scope: the formatter depends on the
  // reader's language, which a module-level constant would fix at import time.
  const pickerDate = new Intl.DateTimeFormat(LOCALE_INTL[locale], {
    day: "numeric",
    month: "short",
  });

  function toggle(photoId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  /*
   * The outcome renders OUTSIDE the form.
   *
   * Adding the last available photos empties the picker, and an empty picker
   * replaces the whole form with the note below — taking any message inside it
   * along too. So staff added photos and were told nothing at all, on exactly
   * the run where they had finished. Fourth instance of this shape in the
   * codebase: if success changes what renders, the message cannot live inside
   * the thing that disappears.
   */
  const outcome = (
    <>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </>
  );

  if (photos.length === 0) {
    return (
      <div className="space-y-4">
        {outcome}
        <p className="text-sm text-ink-soft">{t.allAdded}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="albumId" value={albumId} />

      {outcome}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((photo) => {
          const checked = selected.has(photo.id);
          const taken = pickerDate.format(photo.createdAt);
          /*
           * Every tile needs a name of its own.
           *
           * Without one this was a grid of checkboxes announced as "checkbox,
           * checkbox, checkbox" — the thumbnail carried all the meaning, so a
           * screen reader user had no way to tell which photo they were
           * ticking. The caption, or failing that the date it was taken, is
           * what distinguishes one from another, and it is shown visually too:
           * a wall of similar thumbnails is hard to pick from for everybody.
           */
          const label = photo.caption ?? fill(t.photoTakenAlt, { date: taken });

          return (
            <li key={photo.id}>
              {/*
                A real checkbox inside the label, visually hidden. Keyboard
                reachable and it announces its state; a div with an onClick
                would be neither.
              */}
              <label
                className={cn(
                  "block cursor-pointer overflow-hidden rounded-xl border-2 transition-colors",
                  "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky",
                  checked ? "border-leaf" : "border-transparent hover:border-ink/20",
                )}
              >
                <input
                  type="checkbox"
                  name="photoIds"
                  value={photo.id}
                  checked={checked}
                  onChange={() => toggle(photo.id)}
                  aria-label={label}
                  className="sr-only"
                />
                <span className="relative block aspect-square bg-paper-deep">
                  {/* Decorative: the checkbox above carries the name. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/img/${photo.id}?v=thumb`}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {checked ? (
                    <span className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-leaf text-sm font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                </span>
                {/* A caption is the staff member's own words, so it may be in
                    either language regardless of the interface. */}
                <span
                  dir="auto"
                  className="block truncate px-1.5 py-1 text-xs text-ink-soft"
                >
                  {photo.caption ?? taken}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <AddButton count={selected.size} t={t} locale={locale} />
        {nextCursor ? (
          <a
            href={`?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-sm font-semibold text-leaf underline underline-offset-4"
          >
            {t.showOlder}
          </a>
        ) : null}
      </div>
    </form>
  );
}

function AddButton({
  count,
  t,
  locale,
}: {
  count: number;
  t: T;
  locale: Locale;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? t.adding
        : count === 0
          ? t.selectToAdd
          : plural(t.addN, count, locale)}
    </Button>
  );
}

/**
 * One album photo. Shows cover/remove controls only to someone who can edit —
 * a teacher viewing another class's published album sees the tiles, read-only.
 */
export function AlbumPhotoCard({
  albumId,
  photo,
  isCover,
  canManage,
  t,
}: {
  albumId: string;
  photo: {
    id: string;
    caption: string | null;
    publishedAt: Date | null;
    visibility: string;
  };
  isCover: boolean;
  canManage: boolean;
  t: T;
}) {
  const [removeState, remove] = useActionState<AlbumFormState, FormData>(
    removePhotoAction,
    {},
  );
  const [coverState, setCover] = useActionState<AlbumFormState, FormData>(
    setCoverAction,
    {},
  );

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-card shadow-pin">
      <div className="relative aspect-square bg-paper-deep">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/img/${photo.id}?v=thumb`}
          alt={photo.caption ?? t.photoInAlbumAlt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {isCover ? (
          <span className="absolute start-1.5 top-1.5 rounded-full bg-leaf px-2 py-0.5 text-xs font-bold text-white">
            {t.cover}
          </span>
        ) : null}
        {canManage && !photo.publishedAt ? (
          /*
           * The single most confusing thing about albums, called out on every
           * tile that needs it: adding a photo to an album does not share it.
           * Only shown to an editor — a view-only teacher cannot act on it.
           */
          <span className="absolute bottom-1.5 start-1.5 end-1.5 rounded-lg bg-sun-soft px-2 py-1 text-center text-xs font-bold">
            {t.notSharedYet}
          </span>
        ) : null}
      </div>

      {canManage ? (
        <>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            {isCover ? (
              <span className="text-xs text-ink-faint">{t.albumCover}</span>
            ) : (
              <form action={setCover}>
                <input type="hidden" name="albumId" value={albumId} />
                <input type="hidden" name="photoId" value={photo.id} />
                <button
                  type="submit"
                  className="text-xs font-semibold text-leaf underline underline-offset-2"
                >
                  {t.makeCover}
                </button>
              </form>
            )}

            <form action={remove}>
              <input type="hidden" name="albumId" value={albumId} />
              <input type="hidden" name="photoId" value={photo.id} />
              <button
                type="submit"
                className="text-xs font-semibold text-danger underline underline-offset-2"
              >
                {t.remove}
              </button>
            </form>
          </div>

          {removeState.error ? (
            <p className="px-2 pb-2 text-xs font-semibold text-danger">
              {removeState.error}
            </p>
          ) : null}
          {coverState.error ? (
            <p className="px-2 pb-2 text-xs font-semibold text-danger">
              {coverState.error}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function PublishAlbumForm({
  albumId,
  reachable,
  total,
  t,
}: {
  albumId: string;
  reachable: number;
  total: number;
  t: T;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    publishAlbumAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="albumId" value={albumId} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {reachable === 0 && total > 0 ? (
        <Alert tone="info">{t.noneShared}</Alert>
      ) : null}

      <Pending label={t.publishAlbum} pendingLabel={t.publishing} />
      <p className="text-sm text-ink-soft">{t.publishNote}</p>
    </form>
  );
}

export function UnpublishAlbumForm({
  albumId,
  t,
}: {
  albumId: string;
  t: T;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    unpublishAlbumAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="albumId" value={albumId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Pending
        label={t.withdrawAlbum}
        pendingLabel={t.withdrawing}
        variant="secondary"
      />
      <p className="text-sm text-ink-soft">{t.withdrawNote}</p>
    </form>
  );
}

/**
 * Delete the album.
 *
 * Typed confirmation, matching the pattern used for deleting a child, because
 * "Delete" next to "Withdraw" is easy to hit by mistake. The album's photos are
 * never touched — the copy says so, since that is the fear this button raises.
 */
export function DeleteAlbumForm({
  albumId,
  title,
  t,
}: {
  albumId: string;
  title: string;
  t: T;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    deleteAlbumAction,
    {},
  );
  const [confirm, setConfirm] = useState("");

  const matches = confirm.trim().toLowerCase() === title.trim().toLowerCase();

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="albumId" value={albumId} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {/* The album title is the staff member's own text and can be in either
          script, so the label reads whichever way the title runs. */}
      <label
        htmlFor={`confirm-${albumId}`}
        dir="auto"
        className="block text-sm font-bold text-ink"
      >
        {fill(t.confirmType, { title })}
      </label>
      <input
        id={`confirm-${albumId}`}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="off"
        dir="auto"
        className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-danger focus:outline-none"
      />

      <Button
        type="submit"
        variant="secondary"
        disabled={!matches}
        className="border-danger/40 text-danger hover:border-danger hover:text-danger"
      >
        {t.deleteAlbum}
      </Button>
      <p className="text-sm text-ink-soft">{t.deleteNote}</p>
    </form>
  );
}
