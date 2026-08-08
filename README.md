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

`.env.local` needs a Supabase project's URL and anon key at minimum (see
`.env.local.example`). Until Phase 1's migrations are written and applied, no catalog
data exists yet — see `docs/IMPLEMENTATION_PLAN.md`.

## Scripts

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` / `npm run start` — production build and serve
- `npm run lint` — ESLint
- `npm run type-check` — `tsc --noEmit`
- `npm run format` — Prettier, writes in place

## Project status

Phase 0 (Foundations) of `docs/IMPLEMENTATION_PLAN.md`: app scaffold, TypeScript strict
mode, Tailwind, and locale routing (`/hy`, `/en`, `/ru`) are wired up. No catalog
database, data layer, or pages beyond a placeholder home route exist yet — that's
Phase 1 onward.
