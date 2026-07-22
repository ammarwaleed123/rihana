"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, Button } from "@/components/ui/form";
import { Badge } from "@/components/ui/shell";
import {
  deletePhotoAction,
  publishAction,
  unpublishAction,
  setCaptionAction,
  setTagsAction,
  setVisibilityAction,
  type PhotoFormState,
} from "@/lib/admin/photo-actions";
import { cn } from "@/lib/cn";

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  photoConsent: boolean;
};

type Photo = {
  id: string;
  caption: string | null;
  status: string;
  visibility: string;
  publishedAt: Date | null;
  taggedChildren: Array<{ id: string; firstName: string }>;
};

function SaveButton({ label = "Save tags" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="px-4 py-2 text-sm">
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * One photo, with its tagging controls.
 *
 * The whole point of this screen is answering "who is in this photo", so the
 * child chips are the primary control and everything else is secondary. Each
 * chip is a real checkbox inside a label, so it is keyboard reachable and
 * announces its checked state — a div with an onClick would not.
 */
export function PhotoCard({
  photo,
  // Not `children`: React reserves that prop, and a data array passed through
  // it reads as page content rather than as the tag options it is.
  taggableChildren,
  uploadSessionId,
  published,
}: {
  photo: Photo;
  taggableChildren: Child[];
  uploadSessionId: string;
  published: boolean;
}) {
  const [tagState, tagAction] = useActionState<PhotoFormState, FormData>(
    setTagsAction,
    {},
  );
  const [visState, visAction] = useActionState<PhotoFormState, FormData>(
    setVisibilityAction,
    {},
  );
  const [capState, capAction] = useActionState<PhotoFormState, FormData>(
    setCaptionAction,
    {},
  );
  const [delState, delAction] = useActionState<PhotoFormState, FormData>(
    deletePhotoAction,
    {},
  );

  const [selected, setSelected] = useState<Set<string>>(
    new Set(photo.taggedChildren.map((c) => c.id)),
  );

  const isClassAlbum = photo.visibility === "CLASS_ALBUM";
  const reachesNobody = selected.size === 0 && !isClassAlbum;

  function toggle(childId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card shadow-pin">
      <div className="relative aspect-[4/3] bg-paper-deep">
        {photo.status === "READY" || photo.status === "PROCESSING" ? (
          // Served through the authorized route, never straight from storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/img/${photo.id}?v=thumb`}
            alt={photo.caption ?? "Uploaded photo awaiting tags"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm font-semibold text-danger">
            This file could not be processed and will not be shared.
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {photo.status === "PROCESSING" ? (
            <Badge tone="yellow">Processing</Badge>
          ) : null}
          {photo.status === "QUARANTINED" ? (
            <Badge tone="coral">Rejected</Badge>
          ) : null}
          {isClassAlbum ? <Badge tone="sky">Whole class</Badge> : null}
          {published ? <Badge tone="green">Published</Badge> : null}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {reachesNobody ? (
          // The most useful warning on this screen: an untagged photo is
          // invisible to every family, and nothing else would say so.
          <p className="rounded-lg bg-sun-soft px-3 py-2 text-sm font-semibold">
            Nobody is tagged, so no family will see this.
          </p>
        ) : null}

        <form action={tagAction}>
          <input type="hidden" name="photoId" value={photo.id} />
          <input type="hidden" name="uploadSessionId" value={uploadSessionId} />

          <fieldset>
            <legend className="mb-2 text-sm font-bold">Who is in this photo?</legend>

            <div className="flex flex-wrap gap-2">
              {taggableChildren.map((child) => {
                const checked = selected.has(child.id);
                const blocked = !child.photoConsent;

                return (
                  <label
                    key={child.id}
                    className={cn(
                      "cursor-pointer rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors",
                      "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sky",
                      checked
                        ? "border-leaf bg-leaf text-white"
                        : "border-ink/15 bg-card text-ink hover:border-leaf",
                      blocked && "cursor-not-allowed opacity-50",
                    )}
                    title={
                      blocked
                        ? `${child.firstName} cannot be tagged — photo consent withdrawn`
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      name="childIds"
                      value={child.id}
                      checked={checked}
                      disabled={blocked}
                      onChange={() => toggle(child.id)}
                      className="sr-only"
                    />
                    {child.firstName}
                    {blocked ? " (no consent)" : ""}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SaveButton />
            {tagState.success ? (
              <span className="text-sm font-semibold text-leaf-dark">
                {tagState.success}
              </span>
            ) : null}
            {tagState.error ? (
              <span className="text-sm font-semibold text-danger">
                {tagState.error}
              </span>
            ) : null}
          </div>
        </form>

        <form action={visAction} className="border-t border-ink/10 pt-3">
          <input type="hidden" name="photoId" value={photo.id} />
          <input type="hidden" name="uploadSessionId" value={uploadSessionId} />
          <input
            type="hidden"
            name="visibility"
            value={isClassAlbum ? "TAGGED_ONLY" : "CLASS_ALBUM"}
          />
          <button
            type="submit"
            className="text-sm font-semibold text-leaf underline underline-offset-4"
          >
            {isClassAlbum
              ? "Stop sharing with the whole class"
              : "Share with the whole class"}
          </button>
          <p className="mt-1 text-xs text-ink-faint">
            {isClassAlbum
              ? "Every family in this class can see it, tagged or not."
              : "Only the families of tagged children can see it."}
          </p>
          {/*
            Confirmed explicitly rather than left to the button label flipping.
            This control changes who can see a photograph of a child, so it
            should say what it did.
          */}
          {visState.success ? (
            <p className="mt-1 text-sm font-semibold text-leaf-dark">
              {visState.success}
            </p>
          ) : null}
          {visState.error ? (
            <p className="mt-1 text-sm font-semibold text-danger">
              {visState.error}
            </p>
          ) : null}
        </form>

        <form action={capAction} className="border-t border-ink/10 pt-3">
          <input type="hidden" name="photoId" value={photo.id} />
          <input type="hidden" name="uploadSessionId" value={uploadSessionId} />
          <label
            htmlFor={`caption-${photo.id}`}
            className="mb-1.5 block text-sm font-bold"
          >
            Caption
          </label>
          <div className="flex gap-2">
            <input
              id={`caption-${photo.id}`}
              name="caption"
              defaultValue={photo.caption ?? ""}
              maxLength={300}
              placeholder="Painting in the garden"
              className="min-w-0 flex-1 rounded-xl border-2 border-ink/15 bg-card px-3 py-2 text-sm focus:border-leaf focus:outline-none"
            />
            <SaveButton label="Save" />
          </div>
          {capState.error ? (
            <p className="mt-1 text-sm font-semibold text-danger">
              {capState.error}
            </p>
          ) : null}
        </form>

        <form action={delAction} className="border-t border-ink/10 pt-3">
          <input type="hidden" name="photoId" value={photo.id} />
          <input type="hidden" name="uploadSessionId" value={uploadSessionId} />
          <button
            type="submit"
            className="text-sm font-semibold text-danger underline underline-offset-4"
          >
            {/*
              Available after publishing too. Sharing the wrong photo is exactly
              when you most need to remove it, and hiding the control then was
              the wrong instinct.
            */}
            {published ? "Delete this photo permanently" : "Remove this photo"}
          </button>
          <p className="mt-1 text-xs text-ink-faint">
            {published
              ? "Removes it from every family's album and from storage."
              : "It has not been shared with anyone yet."}
          </p>
          {delState.error ? (
            <p className="mt-1 text-sm font-semibold text-danger">
              {delState.error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

/** Publish everything in this upload. */
export function PublishForm({
  uploadSessionId,
  photoCount,
  untaggedCount,
  unpublishedCount,
}: {
  uploadSessionId: string;
  photoCount: number;
  untaggedCount: number;
  unpublishedCount: number;
}) {
  const [state, action] = useActionState<PhotoFormState, FormData>(
    publishAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="uploadSessionId" value={uploadSessionId} />

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {untaggedCount > 0 ? (
        <Alert tone="info">
          {untaggedCount} of {photoCount} photos have nobody tagged. They will
          stay unpublished until someone is tagged, or you share them with the
          whole class.
        </Alert>
      ) : null}

      <PublishButton count={unpublishedCount} />
    </form>
  );
}

/**
 * Withdraw an already-published upload.
 *
 * Owner-only, and deliberately understated next to the publish button — this is
 * the correction path, not a primary action.
 */
export function UnpublishForm({
  uploadSessionId,
  isOwner,
}: {
  uploadSessionId: string;
  isOwner: boolean;
}) {
  const [state, action] = useActionState<PhotoFormState, FormData>(
    unpublishAction,
    {},
  );

  if (!isOwner) {
    return (
      <p className="text-sm text-ink-faint">
        Ask the nursery owner if these need to be withdrawn from families.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="uploadSessionId" value={uploadSessionId} />

      {/* Success is shown by the page after the redirect — this form unmounts. */}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Button type="submit" variant="secondary">
        Withdraw from families
      </Button>
      <p className="text-sm text-ink-soft">
        Hides every photo in this upload from the family portal. The photos and
        their tags are kept, so you can correct them and publish again.
      </p>
    </form>
  );
}

function PublishButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? "Publishing…"
        : `Publish ${count} photo${count === 1 ? "" : "s"} to families`}
    </Button>
  );
}
