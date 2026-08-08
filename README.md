# Lav Auto

Car discovery and comparison platform. Armenia-first, internationalized (Armenian,
English, Russian).

Project planning and architecture live in [`docs/`](./docs) — read
[`docs/README.md`](./docs/README.md) first. This README covers running the app.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Supabase (PostgreSQL) ·
next-intl.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase project's values
npm run dev
```

The app boots at `/` and redirects to the default locale (`/hy`, Armenian — see
`docs/LOCALIZATION.md`). `/en` and `/ru` are also available.

`.env.local` needs a real Supabase project's URL, anon key, and service role key (see
`.env.local.example`). Point it at your own project and apply the schema:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push                                  # applies supabase/migrations/
psql "<your-project-db-url>" -f supabase/seed/dev-seed.sql   # small dev/test fixture
```

## Scripts

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` / `npm run start` — production build and serve
- `npm run lint` — ESLint
- `npm run type-check` — `tsc --noEmit`
- `npm run format` — Prettier, writes in place

## Project status

Phases 0–1 of `docs/IMPLEMENTATION_PLAN.md`: app scaffold, TypeScript strict mode,
Tailwind, locale routing (`/hy`, `/en`, `/ru`), the full catalog schema
(`supabase/migrations/`), a small hand-entered dev/test seed
(`supabase/seed/dev-seed.sql`, explicitly not verified — see its header), and the
`lib/data/*` repository layer are done and verified against a live database. No pages
read from the database yet beyond a placeholder home route — that's Phase 2.
