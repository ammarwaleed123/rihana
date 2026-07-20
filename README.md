# Rihana Nursery

A production website for Rihana Nursery, in three zones:

- **Public site** — marketing pages, programs, admissions inquiries.
- **Parent portal** — photo albums, announcements, pickup authorization.
- **Admin panel** — children, classes, parent accounts, photo upload and tagging.

This application stores photographs of young children. Read
[`docs/security.md`](docs/security.md) before changing anything in `src/lib/auth/`
or `src/lib/data/`.

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run db:migrate             # apply migrations
npm run db:seed                # demo classes, children, parents, photos
npm run dev                    # http://localhost:3000
npm run worker                 # in a second terminal — processes thumbnails
```

The worker is a separate process on purpose: app servers stay stateless, so
they can be restarted or scaled without losing in-flight work. Without it,
uploaded photos stay in `PROCESSING` and never get thumbnails.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, server components & actions |
| Database | PostgreSQL (Supabase) via Prisma, migrations in `prisma/migrations/` |
| Auth | Server-side sessions in Postgres, argon2id password hashing |
| Object storage | S3-compatible (Supabase Storage), private bucket + signed URLs |
| Background jobs | pg-boss, on the same Postgres instance |
| Email | Resend in production, console driver in development |
| Styling | Tailwind CSS v4 with design tokens in `src/app/globals.css` |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run worker` | Background worker — **run this alongside `dev`**, or thumbnails never generate |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint, including the data-layer boundary rule |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest — authorization rules are the critical suite |
| `npm run db:migrate` | Apply migrations (development) |
| `npm run db:deploy` | Apply migrations (production, non-interactive) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run check:secrets` | Fail if any secret is exposed via `NEXT_PUBLIC_` |

## Layout

```
prisma/schema.prisma      data model, with the reasoning in comments
src/app/(public)          marketing site
src/app/(portal)          parent portal — requires PARENT
src/app/(admin)           admin panel — requires OWNER or TEACHER
src/lib/auth/             sessions, password hashing, scope resolution
src/lib/data/             THE ONLY place that queries scoped data
src/lib/storage/          StorageAdapter: S3Driver | LocalDriver
src/lib/email/            EmailAdapter: ResendDriver | ConsoleDriver
src/lib/jobs/             pg-boss queue definitions and handlers
src/messages/             i18n catalogues (en now, ar/RTL later)
docs/                     architecture, security, deployment, admin guide
```

## The one rule

No component queries the database for scoped data. Everything a parent or teacher
can reach goes through `src/lib/data/`, which resolves permissions via
`src/lib/auth/scope.ts`. ESLint fails the build if a page imports the Prisma client
directly. See [`docs/architecture.md`](docs/architecture.md).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how the system fits together
- [`docs/security.md`](docs/security.md) — threat model and review results
- [`docs/deployment.md`](docs/deployment.md) — deploy runbook and smoke tests
- [`docs/admin-guide.md`](docs/admin-guide.md) — for the nursery owner
