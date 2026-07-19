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
4. All metadata, including GPS EXIF, is stripped in the same pass.
5. Anything sharp cannot decode is marked `QUARANTINED` and never served.

### Authentication

- argon2id password hashing.
- Sessions are server-side rows in Postgres; the cookie holds a random 32-byte
  token and the database stores only its SHA-256, so a database leak yields no
  usable sessions.
- Cookies are `httpOnly`, `Secure` (production), `SameSite=Lax`.
- Session ID is rotated on login and on any privilege change.
- Rate limits on login, invite acceptance and password reset, keyed on both IP and
  account.
- Failed logins return one generic message regardless of cause.
- **No open registration.** Parent accounts are created by the owner and activated
  through a single-use, expiring invite token stored hashed.

### Sensitive actions

Password re-entry is required for adding a pickup-authorized person and for
changing an account email. Re-authentication is verified server-side within the
same action, not tracked as a client-side flag.

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

### Privacy

When a child leaves, the admin can archive or fully delete them. Deletion cascades
through photo tags, pickup persons, and — via a queued job — the underlying objects
in storage. Photos are excluded from search indexing at the header level.

---

## Review results

_Pending — completed in Phase 9._

The review pass must verify, with evidence recorded here:

- [ ] IDOR: a second parent account cannot fetch another child's photo by ID
- [ ] IDOR: a parent cannot read or mutate another child's pickup list
- [ ] A teacher cannot read or mutate a class they are not assigned to
- [ ] Signed URLs stop working after their TTL expires
- [ ] Login rate limits fire and lock out as configured
- [ ] EXIF, including GPS, is absent from every stored derivative
- [ ] No secret appears in the client bundle
- [ ] Deleting a child removes their objects from storage
