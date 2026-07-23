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

type AvailablePhoto = { id: string; caption: string | null; createdAt: Date };

const pickerDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

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
}: {
  albumId: string;
  photos: AvailablePhoto[];
  nextCursor: string | null;
}) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    addPhotosAction,
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
        <p className="text-sm text-ink-soft">
          Every photo you can reach is already in this album.
        </p>
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
          const label = photo.caption ?? `Photo taken ${taken}`;

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
                    <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-leaf text-sm font-bold text-white">
                      ✓
                    </span>
                  ) : null}
                </span>
                <span className="block truncate px-1.5 py-1 text-xs text-ink-soft">
                  {photo.caption ?? taken}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <AddButton count={selected.size} />
        {nextCursor ? (
          <a
            href={`?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-sm font-semibold text-leaf underline underline-offset-4"
          >
            Show older photos
          </a>
        ) : null}
      </div>
    </form>
  );
}

function AddButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? "Adding…"
        : count === 0
          ? "Select photos to add"
          : `Add ${count} photo${count === 1 ? "" : "s"}`}
    </Button>
  );
}

/** Remove one photo from the album, and optionally make it the cover. */
export function AlbumPhotoCard({
  albumId,
  photo,
  isCover,
}: {
  albumId: string;
  photo: {
    id: string;
    caption: string | null;
    publishedAt: Date | null;
    visibility: string;
  };
  isCover: boolean;
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
          alt={photo.caption ?? "Photo in this album"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {isCover ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-leaf px-2 py-0.5 text-xs font-bold text-white">
            Cover
          </span>
        ) : null}
        {!photo.publishedAt ? (
          /*
           * The single most confusing thing about albums, called out on every
           * tile that needs it: adding a photo to an album does not share it.
           * Without this, staff publish an album and reasonably assume families
           * can see all of it.
           */
          <span className="absolute bottom-1.5 left-1.5 right-1.5 rounded-lg bg-sun-soft px-2 py-1 text-center text-xs font-bold">
            Not shared yet
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        {isCover ? (
          <span className="text-xs text-ink-faint">Album cover</span>
        ) : (
          <form action={setCover}>
            <input type="hidden" name="albumId" value={albumId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <button
              type="submit"
              className="text-xs font-semibold text-leaf underline underline-offset-2"
            >
              Make cover
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
            Remove
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
    </div>
  );
}

export function PublishAlbumForm({
  albumId,
  reachable,
  total,
}: {
  albumId: string;
  reachable: number;
  total: number;
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
        <Alert tone="info">
          None of these photos have been shared with families yet, so publishing
          the album will not show anything. Publish the photos from the Photos
          page first.
        </Alert>
      ) : null}

      <Pending label="Publish album" pendingLabel="Publishing…" />
      <p className="text-sm text-ink-soft">
        Each family sees only the photos of their own child. An album never
        shows anyone a photo they could not already see.
      </p>
    </form>
  );
}

export function UnpublishAlbumForm({ albumId }: { albumId: string }) {
  const [state, action] = useActionState<AlbumFormState, FormData>(
    unpublishAlbumAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="albumId" value={albumId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Pending
        label="Withdraw album"
        pendingLabel="Withdrawing…"
        variant="secondary"
      />
      <p className="text-sm text-ink-soft">
        Hides the album from families. The photos stay exactly as they are —
        they are still visible in each family&rsquo;s own photo list.
      </p>
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
}: {
  albumId: string;
  title: string;
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

      <label
        htmlFor={`confirm-${albumId}`}
        className="block text-sm font-bold text-ink"
      >
        Type “{title}” to confirm
      </label>
      <input
        id={`confirm-${albumId}`}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="off"
        className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base focus:border-danger focus:outline-none"
      />

      <Button
        type="submit"
        variant="secondary"
        disabled={!matches}
        className="border-danger/40 text-danger hover:border-danger hover:text-danger"
      >
        Delete this album
      </Button>
      <p className="text-sm text-ink-soft">
        Removes the album only. Every photo in it stays in the nursery&rsquo;s
        library and in the families&rsquo; own albums.
      </p>
    </form>
  );
}
