# Security

This application stores photographs of young children, their names, their classes,
and the identities of the people permitted to collect them. That is close to the
most sensitive data a small business can hold. The controls below are requirements,
not suggestions.

> **Review results** are recorded at the bottom of this document. They are filled in
> during the Phase 9 review pass and re-run before any production deploy.

## Threat model

The attacks that actually matter here, in order of likelihood:

| # | Threat | Control |
|---|---|---|
| 1 | A logged-in parent reaches another family's photos by changing an ID | Scope enforced in the data layer; cuid2 IDs; signed URLs minted only post-authorization |
| 2 | A photo URL is forwarded or leaks from a shared device | Signed URLs expire in 5 minutes; bucket is private and not listable |
| 3 | Credential stuffing against parent accounts | argon2id, rate limits on IP and account, generic errors, account lockout |
| 4 | A teacher accesses classes they are not assigned to | `TeacherAssignment` checked server-side on every class-scoped read and write |
| 5 | Malicious file uploaded as a photo | Magic-byte sniffing, size cap, full server-side re-encode, never served from app origin |
| 6 | Child location inferred from photo EXIF GPS | All metadata stripped on ingest, before the file reaches storage |
| 7 | An unauthorized person is added to a pickup list | Password re-entry, owner approval required, full audit trail |
| 8 | Photos indexed by a search engine | `X-Robots-Tag: noindex` on all image and portal routes; no public photo route exists |

## Controls

### Authorization

Every scoped read goes through `src/lib/data/`, which resolves permissions via
`src/lib/auth/scope.ts`. Components never query the database directly, and ESLint
fails the build if one tries (see `eslint.config.mjs`).

`Guardianship` is the only thing that grants a parent access to a child.
`TeacherAssignment` is the only thing that grants a teacher access to a class.
There is no other path, and no UI-level check is trusted.

### Identifiers

All primary keys are cuid2. Nothing is sequential, so nothing is enumerable. An
unauthorized ID returns **404**, never 403 — a 403 would confirm the resource exists.

### Photo delivery

The storage bucket is private and never listable. Images reach the browser only via
`/api/img/<photoId>`, which calls `getPhotoForUser` first and redirects to a signed
URL with a 300-second TTL. The database is never in the byte path, and no photo is
ever served from the application origin.

### Uploads

1. Size cap enforced before the body is read.
2. Content type determined by **magic bytes**, never by extension or the
   client-supplied `Content-Type`.
3. The image is fully re-encoded by sharp. The bytes stored are ours, not the
   uploader's — this is what actually defuses a polyglot or malformed file.
4. All metadata, including GPS EXIF, is stripped in the same pass. `sharp` drops
   it by default, so the guarantee is the *absence* of a `.withMetadata()` call;
   adding one anywhere in `src/lib/images/process.ts` would silently reintroduce
   camera serial numbers and the coordinates a photo was taken at.
5. EXIF orientation is applied before metadata is discarded, or every portrait
   phone photo would arrive sideways.
6. Decompression bombs are capped at 60 megapixels.
7. Anything sharp cannot decode is marked `QUARANTINED` and never served.

Verified two ways: `tests/image-processing.test.ts` asserts the processing
function strips metadata, and `scripts/verify-photo-privacy.ts` downloads the
objects **actually in the bucket** and confirms none of them carries EXIF, XMP,
IPTC or GPS markers. The second is the one that matters to a family.

### Photo delivery

`/api/img/<photoId>` is the only route that serves image bytes, and it does
three things in a fixed order: authenticate, ask the data layer whether this
person may see this photo, and only then mint a signed URL with a 300-second
TTL. An unauthorized id returns 404 before any storage call is made.

`src/lib/data/photo-filter.ts` holds the routing rule and imports nothing at
all — not the database client, not the environment. The most consequential rule
in the application is testable without a connection string, so there is never an
excuse not to test a change to it.

### Authentication

- argon2id password hashing, OWASP parameters (m=19456 KiB, t=2, p=1).
- Sessions are server-side rows in Postgres; the cookie holds a random 32-byte
  token and the database stores only its SHA-256, so a database leak yields no
  usable sessions.
- Cookies are `httpOnly`, `Secure` (production), `SameSite=Lax`, and carry the
  `__Host-` prefix in production so no subdomain can overwrite the session.
- Session ID is rotated on login and on any privilege change.
- Rate limits on login, invite acceptance and password reset, keyed on both IP
  and account — with **deliberately different limits**. The per-account bucket is
  tight (8 per 15 min) because that is what stops someone guessing one family's
  password. The per-IP bucket is far looser (50 per 15 min) because a whole
  household shares one NAT and every device in the nursery shares the office
  address; sizing them equally turned out to mean one parent mistyping their
  password locked out everyone behind the same router. Found by the end-to-end
  test `a different address is unaffected by another's exhausted bucket`.
- Failed logins return one generic message regardless of cause.
- **No open registration.** Parent accounts are created by the owner and activated
  through a single-use, expiring invite token stored hashed.

### Sensitive actions

Password re-entry is required for changing a password and for every safety-critical
pickup change — adding a pickup person, editing one, and switching a child between
door collection and the nursery bus. Re-authentication is verified server-side
within the same action, not tracked as a client-side flag — a flag is something the
client asserts, and this is the control standing between a borrowed unlocked phone
and taking over a family's account, or authorizing a stranger to collect a child.

Re-entry attempts are rate-limited per account (10 per hour), not per address:
this is online guessing against one known user by someone already holding their
browser.

Changing a password invalidates every session for that user and then issues a
fresh one for the browser doing the changing. Every other device is signed out —
which is the whole reason someone changes a password under duress — while the
person who just changed it is not thrown back to the sign-in screen for it.

A parent **cannot change their own email.** The email is issued by the nursery,
and it is both the account's identity and its password-reset destination — so a
parent who could change it could redirect their own reset link and take the
account over from a borrowed unlocked phone. It is shown read-only on the account
page; the nursery sets and corrects it. (The build spec listed email-change
re-auth as a control; that control is moot here because the action does not exist
parent-side. If owner-side email editing is added later, it re-enters as an
owner-only, audited action.)

### Albums

An album is a presentation grouping and **never** widens access. Every
parent-facing album query composes `filterForParent`, the same function the photo
pages use, so an album shows a family exactly the photos they could already see.
The photo count on an album card and the album's cover image are both resolved
through that filter as well — an unfiltered count would disclose how many photos
of other children an album holds, and an unfiltered cover would put one on
screen. See `docs/architecture.md` for the query shape and
`e2e/albums.spec.ts`, which asserts a second family sees strictly less of the
same album.

### Pickup authorization

Who a child may be released to is the most consequential thing a parent controls,
so it sits behind two independent gates:

- **Approval is the gate.** A pickup person is created `PENDING` and appears on no
  door board until an **owner** approves it — exactly as a photo is invisible until
  published. Editing an approved person returns them to `PENDING`: the approval was
  for specific details, and a changed name or number could substitute a different
  person entirely.
- **Re-authentication is the second gate.** Adding, editing, or changing the pickup
  method requires the parent's password, checked server-side (see *Sensitive
  actions*). Removing a person is not gated — it only ever *reduces* who may
  collect, the safe direction.

Every read is scoped through `assertCanViewChild`, the same edge the photo pages
use, so a parent reaches only their own children and a teacher only their classes.
The pickup person's photograph is served through `/api/img/pickup/[id]`, which runs
that same check before minting a short-lived signed URL and returns a 404 — never a
403 — for anything the caller may not see. Removing a person soft-deletes the row
(status `REVOKED`) rather than erasing it, so the audit trail of who was once
authorized, and by whom, survives. Every state change — created, approved,
rejected, revoked, method changed — writes an append-only `AuditLog` row.

### Input and output

Every server action and route handler validates its input with Zod at the boundary.
Prisma parameterizes all queries; no raw SQL string interpolation exists in the
codebase. No user content is ever passed to `dangerouslySetInnerHTML` — ESLint
enforces this via `react/no-danger`.

### Headers and CSRF

CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`,
`X-Frame-Options: DENY`, and `Permissions-Policy` are set in `next.config.ts`.
`form-action 'self'` plus `frame-ancestors 'none'` plus Next's built-in server-action
origin check plus `SameSite=Lax` cookies form the CSRF defence.

### Secrets

Secrets live only in environment variables. `npm run check:secrets` fails the build
if any `NEXT_PUBLIC_`-prefixed variable contains something secret-shaped, since that
prefix inlines values into the client bundle.

### Audit logging

`AuditLog` is append-only. Admin actions and every pickup-authorization change
record actor, action, target, timestamp, and a scrubbed before/after diff. Nothing
in the application layer updates or deletes these rows.

### Photo consent

Withdrawing a child's photo consent takes effect **immediately and
retroactively**, and it is **reversible**. A photo tagged only with that child
stops being visible to anyone, including their own family, the moment consent is
withdrawn — and comes back the moment it is restored.

Consent is a factor in whether a photo is *published*: reachability, computed in
`syncPublicationState`, counts only tags of children who currently have consent,
so a photo reaching nobody-with-consent is unpublished. Withdrawing consent flips
the child's flag and re-derives publication for every photo they are tagged in;
restoring it does the same in reverse. The child's tags are deliberately **kept**,
because they are the record of which photos to bring back — an earlier version
*deleted* them, which made restoration impossible and was a real bug a family
would have hit the first time they changed their mind. The owner is told how many
photos were hidden or restored, and the audit log records the count.

One boundary worth stating plainly: **class-album photos are class-level sharing
and are not gated by an individual child's consent.** A `CLASS_ALBUM` photo stays
visible to the whole class regardless of any one child's consent, and a parent
keeps seeing their class's albums because that access comes from class
membership, not from tagging. The system acts on tags; a class-album photo is not
individually tagged, so withdrawing one child's consent cannot single it out.
Staff who need a specific child kept out of shared photos should tag that child
(so the tag-based rule applies) rather than rely on class-album visibility.

### Privacy

Two distinct paths, because they answer different requests:

- **Archive** — the child has left. Reversible, and photos stay available to
  their guardians, which is what families usually want.
- **Delete** — the family has asked to be erased. Removes the child record,
  every guardian link, their pickup list, and any photo showing *only* that
  child. Photos that also show other children are deliberately kept, since
  destroying them would erase another family's record too. Requires the child's
  full name typed exactly, checked server-side. Storage objects are purged by a
  queued job (wired in Phase 3).

Photos are excluded from search indexing at the header level.

---

## Review results

**Reviewed 2026-08-09**, **dependencies fixed and re-verified 2026-08-10** on
Next 16.3.0 — against the app running in production mode (`next start`) with a
live worker, a real Supabase Postgres and a real S3 bucket.

Re-run the whole pass before any production deploy, and a proportionate subset
whenever a change touches photos, scoping, uploads, or adds a route or an action
reachable without a session. Everything below is a command, not a memory:

```
npm run verify:security     # rls, auth, csrf, pickup, erasure — needs the app + worker running
npm run check:secrets       # secrets in the bundle
npx tsx scripts/verify-storage.ts               # bucket privacy, round trip
npx tsx scripts/verify-photo-privacy.ts         # EXIF/GPS in stored bytes
npm audit
npm test && npx playwright test
```

`verify:security` runs against `VERIFY_BASE_URL` (default `http://localhost:3120`)
and needs a worker consuming the queue, because the erasure check waits on a job.
It creates only throwaway records and removes them however it exits. `playwright
test` does **not** — it reseeds the demo database, which destroys demo photos,
push subscriptions and any manual test data, and resets the owner password.

### The eight required checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | A second parent cannot fetch another child's photo by ID | **PASS** | Guessed photo and album ids, another family's album, another child's pickup page — all 404, never 403. `/api/img/<id>` and `?v=thumb` likewise |
| 2 | A parent cannot read **or mutate** another child's pickup list | **PASS** | Read: 404. Write: signed in as a real parent, on their own form, with the hidden `childId` rewritten in the browser to another family's child and the correct password supplied — nothing was created, and the error did not name the other child |
| 3 | A teacher cannot read or mutate a class they are not assigned to | **PASS** | A child in an unassigned class 404s; `/admin/people` and `/admin/activity` redirect; covered continuously by `e2e/admin.spec.ts` and `e2e/albums.spec.ts` |
| 4 | Signed URLs stop working after their TTL | **PASS** | App TTL is 300s. A 3-second signature fetched the object, then the same URL was refused after expiry with "expired" in the response; a tampered signature was refused too. Note Supabase answers 4xx as **400**, not the 403 AWS returns |
| 5 | Login rate limits fire and lock out | **PASS** | `verify-auth.ts` 19/19, including that unknown-email and wrong-password cost the same time (no account oracle); `e2e/rate-limit.spec.ts` exercises the lockout and that one account's exhausted bucket does not affect another |
| 6 | EXIF, including GPS, absent from every stored derivative | **PASS** | `verify-photo-privacy.ts` 121/121 across every stored original, web and thumbnail |
| 7 | No secret appears in the client bundle | **PASS** | `check-secrets.ts` clean |
| 8 | Deleting a child removes their objects from storage | **FIXED, now PASS** | Was broken — see finding 1. Now driven through the real admin screen: the child's photographs and their pickup people's avatars both leave the bucket |

Also verified, beyond the required list:

- **CSRF.** An attacker origin on another port submitted a cross-site form POST at
  a Server Action while the browser held a live session. The request reached the
  app **without the session cookie** and changed nothing. Session cookies are
  `httpOnly`, `SameSite=Lax`, `Secure` in production; the CSP additionally sets
  `form-action 'self'` and `frame-ancestors 'none'`. Kept as
  `scripts/verify-csrf.ts` — it asserts the POST *arrived* before asserting it
  carried no cookie, because a form that silently failed to fire would otherwise
  pass every remaining check.
- **Forged sessions.** Six shapes — invented tokens, a 64-char hex string shaped
  like a session id, the `__Host-` variant, empty, and a SQL payload — against six
  private routes. None reached content. The proxy's cookie check is presentation
  only; `requireSession()` and the data layer are the controls, and this is what
  proves it.
- **Security headers**, confirmed on the wire: CSP (`default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS with
  preload, COOP/CORP `same-origin`, and `X-Robots-Tag: noindex` on portal and
  image routes.

### Findings

**1 — Deleting a child did not delete their photographs. (High, fixed.)**
`deleteChild` removed the rows and returned the ids of the photos it had
orphaned; the caller logged `"child deleted; storage purge pending queue wiring"`
and enqueued nothing. Every erased child's images stayed in the bucket
indefinitely while the database, the interface and the audit log all reported
them destroyed — on the one request where a family is entitled to expect
otherwise. The ordering was the trap: the rows holding the storage keys are
deleted in the same transaction, so a caller handed only ids had nothing left to
resolve. `deleteChild` now collects the keys first — the child's photos **and**
their pickup people's avatars, which were a second leak in the same path — and
the action enqueues the purge, logging at error level with the keys if the queue
refuses it. Regression-checked by `scripts/verify-erasure.ts`.

**2 — Row-level security was missing on a table added after the lockdown.
(Low, fixed.)** `20260720005455_lock_down_public_api_roles` set up two
independent defences and said its dynamic enumeration meant "a table added in a
later migration cannot be forgotten". Only half of that carries forward: the
REVOKE side is preserved by `ALTER DEFAULT PRIVILEGES`, but Postgres has no
default for RLS, so `push_subscriptions` (Phase 8) arrived with privileges
revoked and RLS off. Nothing was reachable — the first defence held — but the
second had quietly lapsed. Fixed by `20260809180000_rls_for_later_tables`, and
`check-rls.ts` now fails on **any** RLS-off table rather than only when it is
also granted, so the rot cannot continue unnoticed. The tightened check was
confirmed to fire by switching RLS off and watching it fail.

**3 — The auth harness reported false failures against a production build.
(Tooling, fixed.)** `verify-auth.ts` sent only the bare `rihana_session` cookie,
while the app uses the `__Host-` prefix whenever `NODE_ENV=production`. Nine
checks failed for a reason that had nothing to do with the app — against exactly
the mode you would run it in before a deploy. It now sends both names.

**4 — Ten vulnerable production dependencies, five high. (Fixed 2026-08-10.)**
`npm audit` now reports **0 vulnerabilities**, across dev and production alike.

Ten packages was not ten ways in. Sorted by whether they could reach the running
site:

| Count | Packages | Reachable? |
|---|---|---|
| 6 | `prisma`, `@prisma/dev`, `hono`, `@hono/node-server`, `valibot`, `fast-uri` | **No.** The `prisma dev` local toolchain. Not deployed |
| 2 | `postcss`, `nanoid` | **Practically no.** Attacks via malicious CSS; all CSS here is ours, and it is compiled at build time |
| 2 | `next`, its private `sharp` | **Yes.** The two that mattered |

One correction to an earlier draft of this section, because it changed the
decision: **sharp was never the risk it looked like.** Two copies are installed —
`node_modules/sharp` at 0.35.3, which is what the upload pipeline actually loads
(confirmed with `require.resolve`), and Next's private `sharp` at 0.34.5. The
advisory covers `<0.35.0`, so the code that processes attacker-supplied uploads
was already on a fixed version; the vulnerable copy served only Next's image
optimizer, which `images: { remotePatterns: [] }` keeps pointed at our own
assets. Read the tree before ranking the finding.

Of the nine advisories against `next`, most did not apply: no custom server (so
not the SSRF one), no rewrites, and the proxy-bypass advisory is worth reading
against this codebase's own design note — the proxy here is deliberately **not**
the authorization boundary, so a bypass costs a redirect rather than access. That
is why the boundary lives in the data layer, and it is doing its job. Two did
matter: **cache confusion of response bodies** (two advisories), which is exactly
the class of bug that could hand one family's response to another, and a Server
Actions DoS, whose surface the 24 MB upload body limit widens slightly.

Fixed in two steps. `npm audit fix` cleared the six toolchain packages in range
(`prisma` 7.8.0 → 7.9.1). The remaining four were all inside Next, and there is
no patched 16.2.x — the fix ships in 16.3.0 only — so `next` and
`eslint-config-next` were pinned up together, 16.2.10 → 16.3.0. Nothing in the
`version-16` breaking-change list applied: the `middleware` → `proxy` rename, the
`turbopack` config and the ESLint CLI migration were already done.

Verified after the bump: typecheck, lint, 162 unit tests, a clean production
build, then `check-rls` (all tables ON), `verify-auth` 19/19, `verify-csrf` 6/6
and `verify-erasure` 4/4 against the rebuilt server.

**5 — `LiveFilters` navigated on every page load. (Correctness, fixed.)** Found
by the post-upgrade e2e run, which failed seven tests. Four root causes; this was
the one in our own code, and it had been there all along.

The component guarded its "apply the filter" effect with a `useRef` flag meaning
"skip the first render". A ref survives the remount React simulates in Strict
Mode, so the second, deliberately double-invoked pass read the flag as already
set and ran `router.replace()` — on every load of the children list, with no
filter touched. The resulting transition never settled: the page sat on
"Filtering…" and swallowed the next click, so a child's **Manage** link stopped
navigating at all. Three tests died there, including photo-consent withdrawal.

Replaced with a comparison of the filter state against the current URL, which is
idempotent — running it twice costs nothing, which is the property the ref was
only pretending to have. Diagnosis confirmed before the fix by turning Strict
Mode off (passed) and back on (failed again).

The remaining three failures were a test flaw, not an app one: the album picker
force-clicks an `sr-only` **controlled** checkbox, and `force` skips precisely
the actionability wait that covers hydration, so a click landing before React
hydrates is dropped in silence. Both call sites now assert the tick took.

Worth recording for the next upgrade: **all seven failures passed against a
production build before any fix**, which is how they were triaged from "the
framework broke the app" down to one real defect.

### Verified against the production build

The whole suite was then re-run against `next build && next start` rather than
`next dev`, because the dev server is the one thing here that never ships.

| Check | Result |
|---|---|
| e2e, full suite | **153 passed** (12.2m — faster than the 15.0m dev run) |
| unit tests | 162 passed |
| `verify-auth` | 19 passed |
| `verify-csrf` | 6 passed |
| `verify-pickup` | 9 passed |
| `verify-erasure` | 4 passed |
| `verify-storage` | 15 passed — private, not anonymously listable, delete works |
| `verify-photo-privacy` | 121 passed — no EXIF, GPS, XMP or IPTC in any stored derivative |
| `check-rls` | every table ON, no privileges held by a public API role |
| `check-secrets` | no secret reachable from the client bundle |
| `check-db` / `check-fks` | both URLs connect; child deletion cascades confirmed |
| `npm audit` | 0 vulnerabilities |
| headers, on the wire | CSP, nosniff, DENY, HSTS preload, COOP/CORP, no `X-Powered-By`, `noindex` on portal and image routes, photos `private, no-store` |

**489 assertions, 0 failures**, all against the build that ships.

One fix came out of this. `verify-auth.ts` **defaulted to port 3210** — the port
Playwright's dev server uses — so running `npm run verify:auth` on its own
quietly aimed the auth checks at a development build and reported 19/19. Today's
runs were correct only because the port was being overridden by hand. That is the
same failure shape as finding 3: a harness that reports success while examining
the wrong thing, which is worse than no harness, because it manufactures
confidence. All three server-facing scripts now default to 3120.

Still open, and not a defect: the e2e suite's own default remains `next dev`, for
iteration speed. The production run is a deliberate pre-deploy step and belongs
in the deployment runbook rather than in every local loop.

### Not yet verified

These cannot be answered from a laptop and belong to the deploy:

- Cookies actually carry `Secure` under the real environment, and HSTS arrives
  over real HTTPS
- The production bucket is private and not listable (verified for the current
  bucket; re-run `verify-storage.ts` against the production one)
- Database backups exist and a restore has been rehearsed
- The demo seed cannot run against production — `reset-demo.ts` refuses when
  `NODE_ENV=production`, which protects the obvious case but not a production
  `DATABASE_URL` in a non-production shell
