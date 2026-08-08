# Lav Auto — Architecture

## 1. Summary

Lav Auto V1 is a server-rendered, internationalized car discovery and comparison site:
browse makes → models → generations → variants, view grouped specifications, compare
2–3 vehicles side-by-side. No user accounts in V1. The long-term product (garages,
social, businesses, events, messaging) is explicitly out of scope, but the schema and
app boundaries below are chosen so those systems can be *added*, not *retrofitted*.

Guiding constraint from the brief: don't build the future features now, but don't make
decisions that make them expensive later. Section 8 calls out exactly where that
principle drove a specific choice.

## 2. Architectural Risks & Ambiguities

Called out explicitly because they affect the schema/routing decisions below.

| # | Risk / ambiguity | Resolution for V1 |
|---|---|---|
| 1 | Vehicle page URL (`/cars/bmw/3-series/g20/m340i-xdrive`) has no model-year segment, but specs can differ by model year within a trim. | The URL identifies a **variant** (trim line). The variant page shows the latest/representative model year by default with a year selector if the variant has multiple spec revisions. Model year is never part of the canonical URL — this avoids URL explosion (one page per year) and keeps the URL scheme stable long-term. |
| 2 | Specs can also differ by market/region (US vs EU headlights, mph vs km/h source figures). | V1 stores an optional `market` on each spec revision but does not expose market switching in the UI. Data entry defaults to one canonical market per variant (documented in the seed data). Multi-market UI is a future enhancement, not a schema change. |
| 3 | No pricing data is mentioned anywhere in the brief. | Deliberately excluded from V1 schema. Do not add a `price` column speculatively — it's exactly the kind of premature field the brief warns against. Documented here so it isn't "silently forgotten," it's a conscious cut. |
| 4 | "Popular manufacturers" / "popular comparisons" on Home imply some ranking signal, but V1 has no analytics/traffic system. | V1 ships these as curated/static lists (editorially chosen, stored as simple config or a `featured` flag in the DB), not computed rankings. Swapping to computed rankings later is additive. |
| 5 | Vehicle page needs a "basic summary." Free-text summaries would need per-locale translated copy, which is a content-authoring system we don't have in V1. | The summary is **generated**, not stored: an i18n message template (e.g. `"{make} {model} {variant} — {horsepower} hp, {drivetrain}"`) interpolates untranslated identity fields (make/model/variant names) and translated enum labels (drivetrain, body type). No summary text is persisted per locale. If editorial summaries are wanted later, that's an additive `content` table, not a redesign. |
| 6 | Image provider is unspecified ("selected separately"). | Images are modeled as their own table with a `provider` discriminator and an opaque `external_ref`/`url`, accessed only through a data-access function (`lib/data/images.ts`). No component ever hardcodes a CDN URL pattern. |
| 7 | Production automotive dataset/API is unspecified. | The seed dataset is small, hand-entered, and explicitly marked as development/test data (see §7 of the brief, honored in `DATABASE_SCHEMA.md` and seed scripts). All catalog reads go through a repository layer so the source can change from "seed SQL" to "external API sync" without touching UI code. |

## 3. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel Edge/CDN                          │
│   Static & ISR-rendered pages, images, locale-aware routing     │
└───────────────────────────────┬─────────────────────────────────┘
                                 │
┌───────────────────────────────▼─────────────────────────────────┐
│                     Next.js App Router (TS)                     │
│                                                                   │
│  app/[locale]/...              Server Components (default)      │
│  ├─ Rendering & routing        Client Components only where     │
│  ├─ generateMetadata / SEO      interactivity is required        │
│  ├─ next-intl middleware        (selectors, compare tray, forms) │
│                                                                   │
│  lib/data/*  (repository layer) ── the ONLY code that queries    │
│                                     the database                 │
│  lib/units/*  (pure conversion functions, no I/O)                │
│  lib/validation/* (zod schemas, shared client+server)             │
└───────────────────────────────┬─────────────────────────────────┘
                                 │ typed queries (Supabase JS client)
┌───────────────────────────────▼─────────────────────────────────┐
│                    Supabase (Postgres + Auth + Storage)          │
│  - Normalized automotive catalog (see DATABASE_SCHEMA.md)        │
│  - Row Level Security: public read-only policies on all catalog  │
│    tables in V1 (no write path is exposed to the client at all)  │
│  - Auth: not used in V1, but the project exists on Supabase so   │
│    enabling it later needs zero infrastructure change            │
└────────────────────────────────────────────────────────────────┘
```

Key points:

- **Server Components by default.** Catalog pages (manufacturer/model/generation/vehicle)
  are server-rendered/static (ISR) — there's no reason to ship a client bundle to fetch
  data that's already known at request/build time. Client components are used only where
  they earn their cost: the selector chain on Home, the compare tray, unit-toggle
  controls.
- **Single data-access layer.** All Postgres access goes through `lib/data/*` repository
  functions returning typed domain objects. Pages and components never import a Supabase
  client directly. This is what makes "swap the data source later" (§7 of the brief)
  realistic instead of aspirational.
- **No custom backend server.** Postgres via Supabase, business logic in Next.js
  server components/route handlers/server actions where needed (e.g. a search RPC).
  This matches "Vercel-compatible architecture" and avoids a premature microservice.
- **RLS from day one.** Even though V1 has no auth, catalog tables get explicit
  read-only RLS policies now. This means turning on Supabase Auth later for user
  accounts doesn't require an audit of previously-open tables — the security posture is
  correct from the start, per the brief's "security should be considered from the
  beginning" requirement.

## 4. Technology Choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), latest stable 15.x on React 19 | SSR/SSG/ISR, server components, mature Vercel deployment story |
| Language | TypeScript, `strict: true` | Type-safety requirement; catches schema/UI drift at compile time |
| Styling | Tailwind CSS v4 | Utility-first, mobile-first defaults, no CSS-in-JS runtime cost |
| Database | PostgreSQL via Supabase | Relational model fits the normalized schema; Supabase gives Postgres + Auth + Storage + RLS in one Vercel-friendly package |
| i18n | `next-intl` | App Router-native, static rendering compatible, ICU message format (handles Russian/Armenian plural rules correctly), typed message keys |
| Client state (compare only) | Zustand + `persist` (localStorage) | Minimal, no server round-trip needed for an accountless feature; avoided Redux/Context-only because cross-page persistence needs a store, not just component state |
| Validation | Zod | Shared schema validation for search params, form inputs, and repository boundaries |
| Data fetching | Native `fetch`/Supabase JS client in Server Components; no client-side data-fetching library needed in V1 | There's no client-side mutation/polling need yet; adding React Query later (when garages/social land) is additive |

No state-management framework, ORM, or GraphQL layer is introduced in V1 — the brief
explicitly warns against unnecessary dependencies, and Supabase's typed client plus a
thin repository layer is sufficient for a read-mostly catalog.

## 5. Localization Strategy (summary — full detail in `LOCALIZATION.md`)

- URL-prefixed locales: `/en/...`, `/hy/...`, `/ru/...`.
- All UI copy lives in translation keys (`messages/en.json`, `messages/hy.json`,
  `messages/ru.json`), never inline in components.
- Two independent axes are kept separate on purpose: **language locale** (en/hy/ru) and
  **unit system** (metric/imperial). A Russian-speaking user might still want mph.
  Conflating them into one "locale" would be a mistake to unwind later.
- Identifiers (make/model/generation/variant names, engine codes) are stored once in the
  database and rendered as-is in every locale — they are not translation keys.
- Enumerable spec values (body type, fuel type, drivetrain, transmission type,
  aspiration) *are* translated, via a stable `slug`/`code` on the lookup table used as
  the translation key (`t('specs.bodyType.' + bodyType.slug)`), not via a
  database-driven translation table. This keeps translation content in version control
  (reviewable, diffable) instead of scattered across DB rows, appropriate for a small,
  fixed enum set. If Lav Auto later needs editor-authored, per-locale long-form content
  (e.g. club descriptions, business bios), that's the point to introduce a proper
  `translations` content table — not before.

## 6. Comparison State (summary — full detail in `COMPARISON_STATE.md`)

No accounts in V1, so comparison state is client-local (Zustand + localStorage) and
mirrored into the `/compare` URL as query params so a comparison is shareable via link
without a database write. See `COMPARISON_STATE.md` for the full design, including how
this evolves into server-persisted "saved comparisons" once accounts exist.

## 7. SEO Architecture

- Catalog pages (`/[locale]/cars/**`) use `generateStaticParams` + ISR (revalidate on a
  time interval, not on every request — the catalog changes rarely). Pure static
  generation is avoided only because the catalog will grow past what's practical to
  fully pre-render at every build.
- `generateMetadata` per route produces localized `<title>`/`<meta description>`,
  `alternates.canonical`, and `alternates.languages` (hreflang) for all three locales.
- Vehicle pages emit `Vehicle`/`Product`-style JSON-LD structured data built from the
  same repository data used to render the page (single source of truth, no duplicate
  data entry).
- `/compare` is functionally a client-driven view over query-string state; it is
  `noindex` (comparisons are infinite in combination and not meaningful to index),
  while every vehicle linked from it is independently indexable at its canonical URL.

## 8. Future Platform Evolution

The brief lists a large long-term feature set. None of it is built now. This section
exists to show the current design doesn't block it.

| Future system | How it attaches without redesigning V1 |
|---|---|
| User accounts / profiles | Supabase Auth, additive. RLS policies added to *new* tables only; catalog tables stay public-read. |
| Personal virtual garage / owned vehicles | New `garage_vehicles` table: `user_id → auth.users`, `variant_id → variants`, `model_year int`. References the **variant**, the stable catalog entity (see §9, decision 2) — never a spec revision, which is an internal data-correction artifact. |
| Vehicle photos / builds / modifications | New tables FK'd to `garage_vehicles`. Independent of the catalog `vehicle_images` table (which holds *stock/reference* images, not user uploads). Supabase Storage buckets, separate from whatever provider serves catalog images. |
| Social posts, following | New `posts`, `follows` tables FK'd to `auth.users`. Optionally `posts.variant_id` for "posted about this car" — again referencing `variants`. |
| Make/model clubs, local communities | New `clubs` table, optionally FK'd to `models` (make/model-specific) — the normalized make/model tables already support this join cleanly; a flat `cars` table would not have. |
| Dealers, mechanics, detailers, tuners, parts businesses | New `businesses` table family, independent of the catalog. Vehicle inventory/listings (if ever added) reference `variants`, not a duplicated business-owned copy of spec data. |
| Reviews | New `reviews` table FK'd to `variant_id` (+ optionally `garage_vehicle_id` for verified-owner reviews) and `user_id`. |
| Quizzes / achievements / points / sponsored rewards | New, fully independent tables; may reference `makes`/`models`/`variants` for quiz content but need nothing from them structurally. |
| Business advertising, events, notifications, messaging | New subsystems with no FK dependency on the catalog at all. |

The unifying idea: **the catalog (`makes` → `models` → `generations` → `variants` →
spec tables) is a stable, read-mostly reference dataset that every future
user/business/social table points *into*, never the other way around.** V1 never has to
anticipate the shape of `posts` or `clubs` — it only has to make sure `variants` is a
clean, stable join target, which drives decision 2 in §9.

## 9. Decisions That Would Be Expensive to Change Later

These are called out explicitly, per the brief's requirement, because getting them
wrong now costs materially more later (data migration, broken inbound links, or a
schema redesign under load).

1. **Slug-based URL scheme and uniqueness.** `make.slug`, `(make, model).slug`,
   `(model, generation).slug`, `(generation, variant).slug` are the permanent public
   identifiers baked into every indexed URL and every future inbound link. Changing the
   slugging rules after SEO indexing has value means redirects at best, broken links and
   lost ranking at worst. Decided now: lowercase, hyphenated, ASCII, generated once at
   data-entry time and never auto-regenerated from the display name (so renaming a
   display label doesn't silently change a live URL).
2. **`variants` as the stable entity future systems reference.** As shown in §8, every
   future user/business table that needs to point at "a car" should FK to
   `variants.id`, not to a specific `spec_revision` (which is an internal, correctable,
   effective-dated data artifact — see `DATABASE_SCHEMA.md`) and not to a flat row in a
   giant `cars` table (which the brief already rules out). Picking the wrong join target
   here means migrating every future FK once real user data exists on top of it.
3. **Canonical unit storage.** All measurements are stored once, in a single canonical
   SI-ish unit per field (mm, kg, kWh, km/h, Nm, litres, seconds — see
   `DATABASE_SCHEMA.md` for the full list), never as formatted strings and never
   duplicated in alternate units. Display-time conversion is a pure function. Changing
   the canonical unit later requires a data migration across every numeric column, so
   the unit-per-column is fixed at schema design time and documented directly in column
   names (`length_mm`, not `length`).
4. **i18n routing strategy (URL-prefixed locales).** `/en`, `/hy`, `/ru` prefixes are
   baked into every indexed URL. Switching to domain-based or cookie-based locale
   routing later would change every canonical URL Lav Auto has ever had indexed.
   Decided now, not deferred.
5. **Primary key strategy.** Catalog tables use `bigint identity` primary keys (simple,
   fast, sufficient — these rows are public reference data, not access-controlled
   resources, so there's no need to hide sequential IDs). Future user-owned tables
   (garage entries, posts, reviews, businesses) should use `uuid` primary keys to match
   Supabase Auth's `auth.users.id` type and conventional RLS patterns. This is a
   deliberate split, not an inconsistency — documented here so a future contributor
   doesn't "fix" it into one or the other without understanding why, which would mean
   migrating either the whole catalog or the whole user-data side.
6. **Keeping the catalog schema RLS-public and auth-independent.** Nothing in the
   catalog schema references `auth.users`. This is what makes "add accounts later"
   additive instead of a migration of existing rows.

## 10. What This Document Deliberately Does Not Cover

- Any UI visual design/component library choice beyond Tailwind — that's implementation
  detail, not architecture.
- The production automotive data source/API — explicitly deferred per the brief ("will
  be selected separately").
- Any of the long-term feature systems in §8 beyond how the schema stays open to them.
