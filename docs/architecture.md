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

Album membership is presentation only. An album never widens access; a parent sees
an album as the subset of its photos they were already entitled to, and an album
that resolves to zero photos for them does not appear at all.

## Request paths

### Photo upload

```
admin browser
  -> POST /admin/photos/upload      (server action, CSRF + origin checked)
     - Zod validation, size cap
     - magic-byte sniff (file-type), NOT the extension or client MIME
     - sharp: re-encode, strip ALL metadata incl. GPS EXIF
     - PUT original + web variant to private bucket
     - row: Photo{status: UPLOADED}
  -> enqueue photo.process (per photo)
  -> returns immediately; 200 photos never block the request
       |
worker (pg-boss)
  photo.process     -> thumbnail, dimensions, Photo{status: READY}
  notify.photos-published -> fan-out, one Notification per affected parent,
                             deduped by (userId, dedupeKey)
  email.send        -> one batched email per parent per publish event
```

Re-encoding is what actually neutralises a malicious upload: the bytes that land in
the bucket are produced by sharp, not by the uploader. Anything sharp cannot decode
is marked `QUARANTINED` and never served.

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
- **Cursor pagination everywhere.** Keyset on `(createdAt, id)`; no `OFFSET`, no
  unbounded query. The parent album paginates off the covering index
  `photo_tags(childId, photoCreatedAt DESC)` without a join.
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
