# Build Prompt: Nursery School Website ("Little Palms" — rename as instructed)

You are building a production-ready website for a nursery school and deploying it live. Work in phases, verify each phase before moving on, and treat security and privacy as hard requirements — this system stores photos of young children, which is among the most sensitive data a small business can hold.

---

## 1. What you are building

Three zones in one application:

1. **Public marketing site** — Home, About, Programs (3 age groups), A Day at the Nursery, Admissions with inquiry form, FAQ, Contact (map, phone, WhatsApp link). Mobile-first. Bilingual-ready structure (English now, Arabic/RTL later — build the i18n scaffolding, don't hardcode strings).
2. **Parent portal** (login required) — dashboard, photo albums, announcements feed, pickup authorization, account settings.
3. **Admin panel** (owner + teachers) — manage children, classes, parent accounts, photo uploads with tagging, announcements, view inquiries, review pickup authorizations.

### The three flagship features (must be fully implemented, not stubbed)

**A. Photo tagging with auto-routing to parents**
- Admin/teacher bulk-uploads photos and tags which children appear in each photo (multi-select UI; a photo can be tagged with several children or marked as a "class album" photo).
- Routing rule: a parent's album automatically shows (a) every photo tagged with their own child and (b) class-album photos for their child's class. Nothing else, ever.
- Parents can view photos in-browser and download originals of their own child's photos.

**B. Notifications when new photos arrive**
- When photos are published, notify the affected parents only: in-app notification (bell + unread count) plus email ("3 new photos of Laila were added"). Batch per upload session — one email per publish event, never one email per photo.
- Notification preferences page: parents can toggle email notifications. Also fire notifications for new announcements targeted at their class.
- Architect this as an async job (queue/background worker), not inline in the upload request.

**C. Pickup authorization**
- Each parent maintains a list of people authorized to collect their child: name, relationship, phone, and a photo of the person.
- Adding a new authorized person requires the parent's password re-entry (sensitive action) and appears to staff as "pending" until the owner approves it in the admin panel.
- Staff view: a per-class "who may pick up whom" screen with photos, optimized for a tablet at the door. Include an audit log of every change (who added/removed whom, when).

---

## 2. Stack (use this unless something is impossible in your environment)

- **Next.js (App Router) + TypeScript**, server components/actions for data access.
- **PostgreSQL** via Prisma (or Drizzle) with migrations checked into the repo.
- **Object storage (S3-compatible)** for photos — never store image binaries in the database or the app filesystem.
- **Auth.js or Lucia** for session-based auth (httpOnly, Secure, SameSite cookies). No JWTs in localStorage.
- **Background jobs**: a queue for notification fan-out and image processing (e.g., pg-boss on Postgres to keep infra simple, or the platform's native queue).
- **Email**: transactional provider (Resend/SES/Postmark) behind an interface so it's swappable.
- **Deployment target**: Vercel/Railway/Fly (or provided host) + managed Postgres + S3/R2 bucket + CDN in front of image delivery. Provide exact deploy steps, required environment variables (documented in `.env.example`, never committed with real values), and a post-deploy smoke-test checklist.

---

## 3. Security requirements (non-negotiable)

Apply OWASP Top 10 discipline throughout. Specifically:

1. **Authorization on every data access.** Every query for photos, children, notifications, and pickup lists must filter by the authenticated user's permitted scope *in the data layer* (centralized helper, e.g. `getPhotosForParent(session)`), not in the UI. Write this rule once and reuse it — a parent must never be able to reach another child's individual photos by guessing IDs.
2. **No direct object references.** Use non-sequential public IDs (UUID/cuid) for all resources. Photo files served only via short-lived signed URLs generated after an authorization check — the bucket itself is private, never publicly listable.
3. **Roles**: `owner`, `teacher`, `parent`. Teachers can only manage their assigned classes. Enforce server-side; middleware protects all `/admin` and `/portal` routes.
4. **Upload safety**: validate MIME type by sniffing magic bytes (not extension), cap file size, strip EXIF metadata (GPS!) on ingest, re-encode images server-side, and generate thumbnails in the background worker. Uploaded files are never executed or served from the app origin.
5. **Input handling**: schema-validate every input (Zod) at the server boundary; parameterized queries only (the ORM handles this — never use raw string interpolation); output encoding by default (no `dangerouslySetInnerHTML` with user content).
6. **Auth hygiene**: passwords hashed with argon2id or bcrypt (cost ≥ 12); rate-limit login, signup, and password-reset endpoints; generic error messages on failed login; session rotation on privilege change; parent accounts are created/invited by the admin (no open self-registration — this is a closed system).
7. **CSRF protection** on all mutating requests (framework-native or same-site + origin checks for server actions), security headers (CSP, X-Content-Type-Options, Referrer-Policy, HSTS), and HTTPS everywhere.
8. **Secrets**: environment variables only; nothing sensitive in the client bundle; verify no secret appears in any `NEXT_PUBLIC_` variable.
9. **Sensitive-action re-auth**: password re-entry for adding pickup-authorized persons and changing account email.
10. **Audit logging** for admin actions and pickup-authorization changes (actor, action, target, timestamp).
11. **Privacy**: a data-deletion path (when a child leaves the nursery, admin can archive/delete the child and all their photos, cascading through storage), and photos excluded from search-engine indexing.

Before declaring the project done, do a dedicated security review pass: attempt IDOR against photos and pickup lists as a second parent account, verify signed-URL expiry, confirm rate limits fire, and confirm uploaded EXIF is stripped. Document the results.

---

## 4. Scalability requirements

Design so the app degrades gracefully and stays up under load:

- **Stateless app servers** — all state in Postgres/object storage/queue, so the app can scale horizontally on the platform's autoscaling.
- **CDN-cached, immutable image delivery** — thumbnails and web-sized variants served through the CDN; originals only on explicit download. Photos are the bandwidth cost center; the database should never be in the image-serving path.
- **Pagination everywhere** (albums, notifications, admin lists) — cursor-based, no unbounded queries.
- **Database indexes** on every foreign key and on the hot paths: `(child_id, created_at)` for photos, `(parent_id, read, created_at)` for notifications. Include these in migrations.
- **Async heavy work** — image processing and notification fan-out go through the queue with retries and idempotency keys; an upload of 200 photos must not block or time out the admin's request.
- **N+1 protection** — verify list pages issue a bounded number of queries.
- **Graceful failure** — if email provider or storage is temporarily down, the queue retries; the user-facing app shows friendly errors, never crashes.
- Add basic **observability**: structured logs, error tracking hook (Sentry-compatible), and a health-check endpoint.

Realistic scale target: a few thousand families, tens of thousands of photos, occasional spikes (e.g., graduation-day album drop where every parent opens the site within an hour). The architecture above handles this comfortably; do not add microservices, Kubernetes, or extra infrastructure complexity beyond it.

---

## 5. Design & quality bar

- Professional, warm, playful-but-clean aesthetic appropriate for a nursery. A reference homepage mockup exists (bulletin-board style, construction-paper palette: paper `#FFF9EF`, ink `#33402F`, leaf green `#3E7C4F`, sun yellow `#FFC63F`, coral `#FF7A6E`, sky `#7AC0E4`; Fredoka for display, Nunito for body). Follow its spirit across the whole site; if the mockup file is provided in the repo, match it closely for the homepage.
- Mobile-first: assume parents use phones almost exclusively. The portal should feel app-like.
- Accessibility: semantic HTML, keyboard navigable, visible focus states, alt text, adequate contrast.
- Seed script with demo data (2 classes, 6 children, 4 parent accounts, sample photos) so the owner can click through a working demo immediately.
- Tests for the authorization helpers (the photo-routing and pickup-scope rules) at minimum — these are the correctness-critical logic.

## 6. Working method

1. Confirm the plan and schema first (children, parents, classes, photos, photo_tags, albums, announcements, notifications, pickup_persons, audit_log — with the parent↔child many-to-many).
2. Build in this order: auth + roles → data model + admin CRUD → photo upload/tagging/routing → parent portal + albums → notifications → pickup authorization → public site → polish.
3. After each phase, run it, click through it, and fix before continuing.
4. Finish with: deployment executed (or exact step-by-step deploy runbook if credentials aren't available), the security review results, `.env.example`, and a short admin user guide (how to add a child, upload & tag photos, approve a pickup person).

If any requirement conflicts with your environment's constraints, state the conflict and propose the closest secure alternative rather than silently dropping the requirement.
