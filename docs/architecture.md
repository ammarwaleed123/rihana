# Rihana Nursery — architecture

The system stores photographs of young children. Every decision below is downstream
of that fact: the default answer to "who can see this?" is *nobody*, and access is
granted only by an explicit, tested rule.

## Zones

| Zone | Route prefix | Who | Auth |
|---|---|---|---|
| Public marketing site | `/` | anyone | none |
| Parent portal | `/portal` | `PARENT` | required |
| Admin panel | `/admin` | `OWNER`, `TEACHER` | required |

`middleware.ts` rejects unauthenticated requests to `/portal` and `/admin` before a
page renders. Middleware is a coarse gate, not the authorization boundary — the real
boundary is the data layer.

## The authorization boundary

**Rule: no React component ever calls Prisma for scoped data.**

Everything a parent or teacher can reach is fetched through `src/lib/data/`, whose
functions all take the `Session` as their first argument and resolve scope through
`src/lib/auth/scope.ts`. This is the "write it once and reuse it" requirement, made
structural: an ESLint rule (`no-restricted-imports` on the Prisma client outside
`src/lib/data/`) fails the build if a page tries to go around it.

```
src/lib/auth/scope.ts
  requireSession()                     -> Session | redirect
  requireRole(session, ...roles)       -> asserts or throws Forbidden
  childIdsForParent(userId)            -> via Guardianship
  classIdsForParent(userId)            -> Guardianship -> Child.classId
  classIdsForTeacher(userId)           -> via TeacherAssignment
  assertCanViewChild(session, childId)
  assertCanManageClass(session, classId)
```

### Who may do what

| Action | Owner | Teacher | Parent |
|---|---|---|---|
| View a published album (+ its photos) | all | **all teachers** | own children (portal) |
| View a draft album | all | own classes only | no |
| Create / edit albums | all | own classes only | no |
| Create a nursery-wide album | yes | no | no |
| Move an album between classes | yes | no | no |
| Publish / withdraw / delete an album | yes | own classes only | no |
| Change own name and phone | yes | yes | yes |
| Change own password | yes | yes | yes |
| Change own email | no (owner sets it) | no | no |
| View children | all | own classes only | own children (portal) |
| Create / edit / archive children | yes | no | no |
| Delete a child permanently | yes | no | no |
| Create / edit / archive classes | yes | no | no |
| Assign teachers to classes | yes | no | no |
| Invite or disable accounts | yes | no | no |
| Link or unlink guardians | yes | no | no |
| Read the audit log | yes | no | no |

Writes to people, classes and guardianships are owner-only on purpose: each of
them changes *who can see photographs of a child*, which is the owner's decision
as the data controller. Teachers get read access to their own classes plus, from
Phase 3, photo upload and tagging within them.

Navigation hides what a teacher cannot use, but hiding a link is never the
control — every owner-only page re-checks the role and redirects, and every
scoped read filters in the query.

### Photo routing (the flagship rule)

A parent's album is exactly:

- **(a)** every photo tagged with one of their own children, plus
- **(b)** every `CLASS_ALBUM` photo belonging to one of their children's classes.

Nothing else. This lives in exactly one function, `getPhotosForParent`:

```
WHERE status = READY AND publishedAt IS NOT NULL AND deletedAt IS NULL
  AND (
       id IN (SELECT photoId FROM photo_tags WHERE childId = ANY($myChildIds))
    OR (visibility = 'CLASS_ALBUM' AND classId = ANY($myChildrensClassIds))
  )
```

`getPhotoForUser(session, photoId)` is the single gate in front of image delivery.
A signed URL is minted **only** after it returns non-null, so an unauthorized ID
produces a 404 before any storage call is made. Guessing IDs yields nothing, and
cuid2 keys make guessing infeasible in the first place.

For a **teacher**, that gate allows two kinds of photo: any photo of their own
assigned classes (including unpublished ones — they do the tagging), and any
photo that sits in a **published album**, of any class. Published albums are
shared staff-wide: every teacher can view one and the photos in it, even across
classes, which is what lets a Sunflowers teacher see the Olives pictures an owner
grouped into a Sunflowers album instead of a wall of broken thumbnails. Viewing
is not editing — an album's edit controls (add, remove, cover, publish, delete,
rename, move) stay restricted to the owner and the assigned teacher, enforced on
the write path via `canManageAlbum`, not here.

Album membership is presentation only. An album never widens access; a parent sees
an album as the subset of its photos they were already entitled to, and an album
that resolves to zero photos for them does not appear at all.

`src/lib/data/albums.ts` composes `filterForParent` — the same function the photo
pages use — rather than restating the rule. Two expressions of one access rule is
one too many, and the second is always the one left behind when the first is
corrected.

```
albums WHERE status = PUBLISHED AND deletedAt IS NULL
  AND EXISTS (album_photos ap JOIN photos p ON ap.photo_id = p.id
              WHERE ap.album_id = albums.id AND <the routing rule>)
```

Three consequences, each of which is a way this could otherwise leak:

- The **photo count on an album card** is counted through the same filter. It is
  how many photos *this family* can see, never the album's real size — the real
  size would disclose how many photos of other children it holds.
- The **cover photo** is resolved per family. If the album's chosen cover is a
  photo they may not see, they get the first one they can. Covers for a whole
  page are checked in one query, not one per album.
- Album detail returns **null** for "no such album", "not published" and
  "contains nothing for you" alike, and the page turns all three into a 404.

### Cursor composition — the bug that made this rule fail

Keyset conditions are `OR`, and so is the routing rule. Merging them with an
object spread means the cursor's `OR` **replaces** the rule's — the key wins, not
the intent, and the type checker is perfectly happy. That shipped in Phase 3:
page 1 of a parent's album was correct, and every page after it returned every
published photo in the nursery. It took twenty-five photos and a tap on "Load
more" to show itself, so neither the tests nor a manual pass ever saw it.

`olderThan(cursor)` and `publishedBefore(cursor)` therefore return **arrays**, and
every paginated query composes them as:

```ts
where: { AND: [scopeFilter, ...olderThan(cursor)] }
```

There is nothing to spread into an object, so the mistake cannot be typed.
`tests/pagination.test.ts` asserts the routing rule survives the composition, and
spells out the broken form so the failure is legible.

## Request paths

### Photo upload

```
staff browser
  -> POST /admin/photos            (server action, CSRF + origin checked)
     - size cap checked before the body is read
     - magic-byte sniff (file-type), NOT the extension or client MIME
     - sharp: apply EXIF orientation, re-encode, strip ALL metadata
     - PUT original + web variant to the private bucket
     - row: Photo{status: PROCESSING}   <- not visible to anyone yet
  -> enqueue photo.process (per photo)
  -> returns immediately; 200 photos never block the request
       |
worker (npm run worker, separate process)
  photo.process     -> thumbnail, Photo{status: READY}
  notify.photos-published -> fan-out, one Notification per family per child,
                             deduped by (userId, dedupeKey)
  notify.announcement     -> fan-out to the audience, deduped on announcement id
  storage.purge     -> remove objects after an erasure
  maintenance       -> expired sessions, rate-limit buckets, and photos
                       stranded in PROCESSING (every 5 minutes)
```

### Notifications (the second flagship)

One table, one mechanism, every channel. "New photos", "new announcement" and
later pickup updates all become a `Notification` row; the in-app bell reads them,
and the app-icon badge and push (Phase 8) will read the same rows. Fan-out runs
in the worker, never in the request that publishes.

- **Who is notified reuses the routing rule.** A parent is notified about a photo
  exactly when they may see it: `fanOutPhotosPublished` counts, per child, the
  session's now-visible photos that child's family newly sees (tagged with the
  child *with consent*, or a class-album for their class), and writes one
  notification per guardian per child — "3 new photos of Laila", never one per
  photo. Consent is honoured here as it is everywhere: a withdrawn child produces
  no notification.
- **Idempotency is structural.** Every row carries a `dedupeKey`
  (`photos:<sessionId>:<childId>`, `announcement:<id>`) and `(userId, dedupeKey)`
  is unique, so the fan-out inserts with `skipDuplicates`. However many times
  pg-boss retries a job, the second pass creates nothing — no check-then-act,
  which would race.
- **Announcement bodies are markdown rendered to React elements only**
  (`AnnouncementBody`), never raw HTML. Links are restricted to http(s); there
  is no `dangerouslySetInnerHTML` anywhere, which is also why no markdown library
  was added — most hand back an HTML string. `tests/announcement-body.test.ts`
  asserts injection attempts degrade to inert text.
- **Preferences** (`emailNewPhotos`, `emailAnnouncements`, `emailPickupUpdates`,
  denormalised booleans on `User`) gate the proactive channels — the badge and
  push in Phase 8, email if it is ever enabled. The in-app bell always shows
  everything; there is nothing to opt out of there.

**A dropped job used to strand a photo forever.** `enqueue` is bounded at five
seconds and never throws, because an upload's job is to store photos and a queue
blip must not fail the request someone is waiting on. The cost is that a photo
whose job was never published stays `PROCESSING` — and `PROCESSING` means
invisible to every family, permanently, with nothing but a small badge on an
admin screen to say so. Two comments claimed the maintenance sweep recovered
these; it did not until Phase 4. It does now, and the sweep runs every five
minutes rather than every fifteen because the interval is now measured in "how
long a family cannot see a photograph of their child".

The trigger in practice is a cold start: the very first `enqueue` against a fresh
database waits on pg-boss running its own migrations, and times out.
`scripts/warm-queue.ts` removes that stall for local runs and the test suite.

Files are handled independently: one unreadable photo among two hundred is
reported and skipped, not a reason to fail the batch.

Re-encoding is what actually neutralises a malicious upload — the bytes in the
bucket are sharp's output, not the uploader's. Anything sharp cannot decode is
marked `QUARANTINED` and never served.

Publishing is a separate, deliberate step. Photos with neither tags nor
class-album visibility are left unpublished rather than published into the void,
because silently publishing them would hide a tagging mistake.

**Publication is a property of the photo, not a one-shot event on the session.**
`syncPublicationState` runs after anything that changes whether a photo can
reach a family, and derives `publishedAt` from three facts: the session is
published, the photo is not deleted, and somebody can actually see it. It works
in both directions — removing the last tag from a `TAGGED_ONLY` photo withdraws
it again. Treating publishing as a one-time event meant a photo tagged *after*
its session was published stayed invisible forever, with nothing to indicate
anything was wrong.

An owner can withdraw a published upload. Photos and tags are kept, so a
mistake can be corrected and published again.

### Uploading is batched in the browser

Server actions carry a bounded body, and 200 photos is gigabytes regardless of
the bound. The client therefore creates the upload session first, then sends
files in batches sized to fit one request, reporting progress as it goes. The
number of photos a person can select is unlimited; only one batch is bounded.

### Image delivery

```
browser <img src="/api/img/<photoId>?v=thumb">
  -> getPhotoForUser(session, photoId)   <- authorization, always
  -> 404 if not permitted (no distinction between "missing" and "forbidden")
  -> 302 to a signed URL, TTL 300s
  -> bytes served by storage/CDN, never by the app, never by the database
```

## Scale

The target is a few thousand families and tens of thousands of photos, with spikes
when a graduation album drops and every parent opens the site within the hour.

- **Stateless app servers.** All state is in Postgres, object storage, or the queue.
  Sessions live in Postgres, not in memory, so any instance can serve any request.
- **The database is never in the image path.** It answers "may you see photo X" and
  hands back a key. Bytes come from the bucket via CDN.
- **Cursor pagination on every unbounded list.** Keyset on `(createdAt, id)`; no
  `OFFSET` on the class-wide feeds, the admin lists, or anywhere the row count
  grows with the nursery. The one deliberate exception is the parent-facing
  **photo and album views**, which use numbered offset pages ("page 3 of 12",
  six a page) because families asked for page numbers and prev/next, which keyset
  cannot express. That is safe precisely because the set being paged is *one
  family's own photos* — bounded and small — so the offset walks tens of rows,
  never the nursery's tens of thousands. `pageOffset` in
  `src/lib/data/pagination.ts` is the only offset in the codebase, and the type
  of the value it pages (`NumberedPage`) is the marker for where that trade-off
  was made.
- **Async heavy work.** Image processing and notification fan-out are pg-boss jobs
  with retries and idempotency keys. A retried fan-out cannot double-notify because
  `notifications(userId, dedupeKey)` is unique.
- **Graceful degradation.** If email or storage is down, jobs retry with backoff and
  the UI shows a friendly error. Nothing crashes.

pg-boss runs on the same Postgres instance we already operate. That is a deliberate
ceiling on infrastructure complexity — no Redis, no microservices, no Kubernetes.

## Swappable edges

Two things are behind interfaces so the deployment target is not baked in:

- `StorageAdapter` — `S3Driver` (Supabase Storage, R2, S3; all speak the S3 protocol)
  and `LocalDriver` (dev fallback, writes to `.storage/` outside the public dir).
- `EmailAdapter` — `ResendDriver` and `ConsoleDriver` (dev, with a mailbox viewer).

Both are selected by one env var and neither leaks its vendor into calling code.

## Observability

- Structured JSON logs (pino) with a request id; never log tokens, hashes, or
  storage keys.
- `GET /api/health` — checks database and queue reachability.
- `reportError()` wraps an optional Sentry DSN. Blank DSN disables reporting
  entirely rather than failing.

## What this does not do

Deliberate non-goals, so nobody adds them by reflex: no microservices, no Kubernetes,
no Redis, no separate search cluster, no realtime socket layer, no self-registration
(parent accounts are invite-only by design — this is a closed system).
