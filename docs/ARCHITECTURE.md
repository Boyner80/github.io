# Lav Auto — Architecture

## 1. Summary

Lav Auto V1 is a server-rendered, internationalized car discovery and comparison site:
browse makes → models → generations → variants, view grouped specifications, compare
2–3 vehicles side-by-side. No user accounts in V1. The long-term product (garages,
social, businesses, events, messaging) is explicitly out of scope, but the schema and
app boundaries below are chosen so those systems can be *added*, not *retrofitted*.

**Armenia is Lav Auto's primary market for V1 and the foreseeable early versions.**
The product supports English, Armenian, and Russian throughout, but "primary market"
is a business/data concept, distinct from language: it means Armenia is where vehicle
availability and pricing will eventually be tracked first, and where the app's default
market context points. The global automotive catalog (makes, models, generations,
variants, specs) is never restricted to Armenia — see §11 for the full design and why
that separation matters.

Guiding constraint from the brief: don't build the future features now, but don't make
decisions that make them expensive later. Section 8 calls out exactly where that
principle drove a specific choice; §11 does the same for the Armenia-first requirement.

## 2. Architectural Risks & Ambiguities

Called out explicitly because they affect the schema/routing decisions below.

| # | Risk / ambiguity | Resolution for V1 |
|---|---|---|
| 1 | Vehicle page URL needs to support real, high-volume search intent like "2025 BMW M340i xDrive specs," and specs can differ meaningfully by model year within a trim. | **Revised after architecture review** (see §10): model year is a required path segment — `/cars/bmw/3-series/g20/m340i-xdrive/2025`. It resolves to a `vehicle_configurations` row, the new stable per-year identity introduced in this revision. The year-less path (`/cars/bmw/3-series/g20/m340i-xdrive`) is a real, separately-indexable overview page listing available years, not a redirect. See §10 for the full identity model and §7 for the URL strategy. |
| 2 | Specs can also differ by regulatory spec region (US-spec vs EU-spec headlights, mph vs km/h source figures; a 2024 US-spec M340i xDrive and a 2024 EU-spec M340i xDrive share a trim name but differ in numbers). | **Revised after architecture review** (see §10): spec region is a first-class column on `vehicle_configurations` (not nullable — a seeded `GLOBAL` row is used for undifferentiated data), so the identity model already distinguishes it internally. V1 UI still shows one spec region per catalog entry and does not expose region switching; when it's added, it's a query-param refinement on top of an already-correct schema, not a schema change. |
| 3 | Pricing isn't part of V1 scope, but Armenia is the primary market and Armenian pricing will matter soon — and it must never be conflated with a single global price. | Deliberately excluded from V1 schema; no `price` column anywhere. §11 documents the intended shape (country + currency + configuration + price type + source + date) in enough detail to guarantee nothing added later assumes one universal price, and specifically that AMD/Armenia figures are never derived by converting a US/EU MSRP. |
| 4 | "Popular manufacturers" / "popular comparisons" on Home imply some ranking signal, but V1 has no analytics/traffic system. | V1 ships these as curated/static lists (editorially chosen, stored as simple config or a `featured` flag in the DB), not computed rankings. Swapping to computed rankings later is additive. |
| 5 | Vehicle page needs a "basic summary." Free-text summaries would need per-locale translated copy, which is a content-authoring system we don't have in V1. | The summary is **generated**, not stored: an i18n message template (e.g. `"{make} {model} {variant} — {horsepower} hp, {drivetrain}"`) interpolates untranslated identity fields (make/model/variant names) and translated enum labels (drivetrain, body type). No summary text is persisted per locale. If editorial summaries are wanted later, that's an additive `content` table, not a redesign. |
| 6 | Image provider is unspecified ("selected separately"). | Images are modeled as their own table with a `provider` discriminator and an opaque `external_ref`/`url`, accessed only through a data-access function (`lib/data/images.ts`). No component ever hardcodes a CDN URL pattern. |
| 7 | Production automotive dataset/API is unspecified. | The seed dataset is small, hand-entered, and explicitly marked as development/test data (see §7 of the brief, honored in `DATABASE_SCHEMA.md` and seed scripts). All catalog reads go through a repository layer so the source can change from "seed SQL" to "external API sync" without touching UI code. |
| 8 | The global catalog will inevitably contain makes/models/variants that aren't actually obtainable in Armenia — nothing should imply otherwise. | The catalog (global, spec-only) and Armenian availability are structurally separate — see §11. V1 doesn't populate or display availability at all (no real, sourced Armenian availability data exists yet), so this risk is neutralized by simply not asserting availability either way in V1, rather than by defaulting to "assume available." |

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
| Framework | Next.js 16 (App Router) on React 19 | SSR/SSG/ISR, server components, mature Vercel deployment story. Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` — same next-intl mechanism, new filename, noted here since it's exactly the kind of framework-version detail that goes stale silently. |
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
  data entry), including `modelDate` sourced from the configuration's `model_year`.
- `/compare` is functionally a client-driven view over query-string state; it is
  `noindex` (comparisons are infinite in combination and not meaningful to index),
  while every vehicle linked from it is independently indexable at its canonical URL.

### 7.1 URL strategy (final, post-identity-review)

Every level of the hierarchy is a real, indexable page — not just the leaf:

```
/cars/bmw                                              → manufacturer page
/cars/bmw/3-series                                     → model page
/cars/bmw/3-series/g20                                 → generation page
/cars/bmw/3-series/g20/m340i-xdrive                    → variant overview: lists model
                                                          years available for this trim,
                                                          features the current/latest year
/cars/bmw/3-series/g20/m340i-xdrive/2025               → vehicle page, canonical, resolves
                                                          to a specific vehicle_configuration
```

Decisions, and why:

- **Model year is a required path segment on the leaf page, not a query parameter.**
  Path segments read as distinct, canonical, keyword-matching pages to search engines
  and match how people actually phrase automotive search queries ("2025 bmw m340i
  xdrive specs"). A query parameter is more likely to be treated as a variant of one
  page rather than a distinct one, and reads worse as a shared link. This is consistent
  with every other level of the hierarchy already being a path segment — a query
  parameter here would be an inconsistent exception, not a simplification.
- **The year-less variant path is a real page, not a redirect.** It captures the
  distinct search intent of someone not specifying a year ("bmw m340i xdrive specs")
  and mirrors the recursive pattern already used at every other level (a parent page
  lists and links to its children). It resolves the "current" configuration inline
  (server-rendered, not client-redirected) so it's still a fast, indexable answer on
  its own.
- **Two configurations with byte-identical specs (e.g. 2024 and 2025 unchanged) still
  get two distinct canonical URLs, not one collapsed page.** Each is legitimately
  useful to a different search query, and each self-canonicalizes. This is the same
  pattern automotive sites with real year-over-year SEO traffic use in practice. The
  page content can and should note when a year is "carried over unchanged" rather than
  hide that the two pages are near-duplicates from the user.
- **Spec region is not a path segment in V1.** Unlike model year, the regulatory spec
  region (US-spec, EU-spec, AM, etc.) is not part of the brief's V1 UI scope and most
  users never need to think about it. The page instead resolves its configuration via
  the default resolution algorithm in §10.5 — prefer a verified spec region matching
  the user's market context (Armenia by default), else fall back to `GLOBAL` — and
  always displays which region the shown specs actually came from. `?spec=EU`
  (explicit override) is reserved for a later phase; because `vehicle_configurations`
  already separates spec region as a real column (§10) and §10.5's algorithm already
  accepts an optional override, turning that on later is additive — no data model
  change, just a new route parameter read by the same resolution function. **This is a
  different concept from the Armenia-first country/commercial-market work in §11** — a
  spec region describes regulatory figures, not where a car is sold or what it costs;
  don't conflate the two when either ships further.

## 8. Future Platform Evolution

The brief lists a large long-term feature set. None of it is built now. This section
exists to show the current design doesn't block it.

| Future system | How it attaches without redesigning V1 |
|---|---|
| User accounts / profiles | Supabase Auth, additive. RLS policies added to *new* tables only; catalog tables stay public-read. |
| Personal virtual garage / owned vehicles | New `garage_vehicles` table referencing **`vehicle_configurations`** — the precise, per-year, per-spec-region identity (see §10) — not `variants`. Full reference pattern, including what happens when the user's exact configuration isn't in the catalog, is worked out in §10.4. |
| Vehicle photos / builds / modifications | New tables FK'd to `garage_vehicles`. Independent of the catalog `vehicle_images` table (which holds *stock/reference* images, not user uploads). Supabase Storage buckets, separate from whatever provider serves catalog images. |
| Social posts, following | New `posts`, `follows` tables FK'd to `auth.users`. Optionally `posts.variant_id` (coarse — "posted about the M340i xDrive generally") or `posts.vehicle_configuration_id` (precise — "posted about my specific 2024") depending on the post type. |
| Make/model clubs, local communities | New `clubs` table, optionally FK'd to `models` (make/model-specific) — the normalized make/model tables already support this join cleanly; a flat `cars` table would not have. Clubs are deliberately scoped at the `variant`/`model` level, not per-configuration — "M340i xDrive owners," not "2024 M340i xDrive owners." |
| Dealers, mechanics, detailers, tuners, parts businesses | New `businesses` table family, independent of the catalog, scoped to a `country` (Armenia first — see §11). Vehicle inventory/listings reference `vehicle_configurations` (a listing is for a specific year/spec-region car) and `countries` (which market it's listed in), priced per-listing — not a duplicated business-owned copy of spec data. |
| Armenian vehicle availability & used-car listings | See §11 in full — `vehicle_availability` (official/dealer/importer/used-market classification per variant, country, optionally year) and dealer/listing inventory are both designed but not built in V1. |
| Reviews | New `reviews` table FK'd to `vehicle_configuration_id` (+ optionally `garage_vehicle_id` for verified-owner reviews) and `user_id`. Configuration-level, not variant-level, because a review of "the 2024 pre-facelift" and "the 2025 facelifted" car may legitimately disagree. |
| Quizzes / achievements / points / sponsored rewards | New, fully independent tables; may reference `makes`/`models`/`variants` for quiz content but need nothing from them structurally. |
| Business advertising, events, notifications, messaging | New subsystems with no FK dependency on the catalog at all. |
| Pricing (official MSRP, dealer, used-market, by country/currency) | Not modeled at all in V1 — see §11 for the intended future shape and why nothing here assumes a single price. |

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
2. **`vehicle_configurations` as the stable, *precise* entity future systems reference**
   (revised during the identity review in §10 — the original draft of this document
   pointed future systems at `variants`, which turned out to be too coarse: it can't
   distinguish a 2024 US M340i xDrive from a 2024 EU one, or a pre-facelift car from a
   post-facelift one, which real Garage entries, reviews, and listings need to). As
   shown in §8 and detailed in §10, every future user/business table that needs to know
   *exactly which car* FKs to `vehicle_configurations.id`. `variants` stays the right
   reference for content that intentionally spans years (clubs). Neither ever points at
   `spec_revisions`, which is an internal, reusable content artifact, not an identity —
   see `DATABASE_SCHEMA.md` §5.1. Getting this join target wrong is exactly the kind of
   mistake that's cheap to fix now (no user data exists yet) and expensive later (every
   future FK across garage/reviews/listings would need migrating).
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
7. **Separating regulatory spec region from commercial country, from the start.**
   (Added by the Armenia-first review, §11.) `vehicle_configurations.spec_region_id`
   answers "whose regulatory figures does this data reflect" (US-spec, EU-spec); the
   new `countries` table answers "where does Lav Auto operate commercially"
   (Armenia first). These look similar enough — both are "which region" fields — that
   collapsing them into one table would have been an easy, tempting simplification.
   It would also have been wrong: Armenia has no regulatory spec of its own, and an
   Armenian-market car is always *some other region's* spec import. Once Armenian
   availability/pricing data exists referencing a merged table, un-merging it would
   mean re-classifying every row by hand. Kept apart now, for the cost of one extra
   lookup table.

## 10. Vehicle Identity Model — Deep Dive

This section is the detailed record of the architecture review that introduced
`vehicle_configurations`. It exists so a future contributor understands *why* the
identity model has two layers (`variants` and `vehicle_configurations`) instead of one,
without having to reconstruct the reasoning from the schema alone.

### 10.1 The gap in the original design

The original schema (see `DATABASE_SCHEMA.md`'s revision note) made `variants` the
stable entity and buried model year and market inside `spec_revisions`, an
effective-dated table explicitly documented as an internal, correctable data artifact —
not something safe for external systems to reference. Two real requirements broke that:

1. **SEO/sharing** needs model year to be independently addressable. "2025 BMW M340i
   xDrive specs" is a real, common search phrase; a URL that can't distinguish 2024 from
   2025 can't rank for it, and a link to "the M340i xDrive page" can't be shared as "the
   2025 one" with any precision.
2. **Future Garage entries** need to capture *exactly* which car a user owns — a 2024
   US-market M340i xDrive is a different car from a 2024 EU-market one, even though
   both are, in the original design, the same `variant` row. Referencing `variants`
   from a Garage entry would lose that distinction permanently, and it's exactly the
   kind of thing that's expensive to add back once thousands of garage entries exist
   without it.

### 10.2 Final recommended identity hierarchy

```
Make            (BMW)
  └─ Model            (3 Series)
      └─ Generation        (G20)
          └─ Variant            (M340i xDrive)          — trim identity, spans years
              └─ Vehicle Configuration  (2024, US market)   — precise identity, the "exact car"
                  └─ Spec Revision          (shared, reusable bag of spec values)
```

Two identity layers below Generation, each earning its place:

- **`variants`** — the trim line. Right granularity for the Generation page's variant
  list, for "Add to Comparison" browsing, and for future content that's intentionally
  year-agnostic (an owners' club, a general discussion).
- **`vehicle_configurations`** — variant × model year × market. The precise, addressable
  "exact car" — what a URL resolves to, what a Garage entry references, what a review or
  listing is about.

Spec *content* (`spec_revisions` and its category tables) is deliberately a third,
non-identity layer: many configurations can point at the same spec revision. This is
what avoids the false choice between "duplicate every spec value per year" and "can't
address individual years."

### 10.3 Worked example

```
BMW → 3 Series → G20 → M340i xDrive
                          ├─ configuration: 2022, US   → spec revision A (pre-facelift, US)
                          ├─ configuration: 2023, US   → spec revision A (unchanged — same row, no duplication)
                          ├─ configuration: 2024, US   → spec revision B (facelift: styling + minor torque bump)
                          ├─ configuration: 2024, EU   → spec revision C (facelift, EU fuel/emissions figures differ)
                          └─ configuration: 2025, US   → spec revision B (unchanged from 2024 US)
```

Five configurations, three distinct spec revisions, zero duplicated spec values beyond
what's actually different. URLs:

- `/cars/bmw/3-series/g20/m340i-xdrive/2023` and `/cars/bmw/3-series/g20/m340i-xdrive/2024`
  are both real, independently indexable pages — the second one's content correctly
  reflects the facelift because it points at a different spec revision, even though
  neither page "knows" about facelifts as a concept.
- `/cars/bmw/3-series/g20/m340i-xdrive/2024` (no market specified) resolves to the US
  configuration by default in V1 (the `GLOBAL`/default-market convention, §7.1); the EU
  configuration exists in the data and becomes reachable via `?market=EU` whenever
  market switching ships, with no schema change.

### 10.4 How a future Garage entry references the catalog

```sql
-- illustrative — NOT created in V1, shown to prove the identity model supports it
create table garage_vehicles (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  vehicle_configuration_id  bigint references vehicle_configurations(id),  -- precise match, when known
  variant_id                bigint references variants(id),                -- fallback: trim known, exact year/market not
  unmatched_make            text,                                           -- fallback: not in our catalog at all
  unmatched_model            text,
  unmatched_year_text        text,
  created_at                 timestamptz not null default now(),
  check (
    vehicle_configuration_id is not null
    or variant_id is not null
    or unmatched_make is not null
  )
);
```

Three cases, in preference order:

1. **Exact match found** (the common case, once the catalog is reasonably complete):
   `vehicle_configuration_id` is set. This is what "a 2024 US-market M340i xDrive" in
   the brief's example resolves to — the precise identity from §10.2, not `variants`.
2. **Trim known, exact configuration not yet cataloged** (e.g. Lav Auto has the M340i
   xDrive variant but hasn't entered 2026 data yet): `variant_id` is set,
   `vehicle_configuration_id` is null, and the UI asks for or stores the year as
   free-form user input until the catalog catches up — at which point a background job
   can resolve it to a real `vehicle_configuration_id` once that row exists, without
   changing the garage entry's primary key or requiring the user to re-enter anything.
3. **Vehicle entirely outside the catalog** (an import, a kit car, something Lav Auto
   will never carry structured data for): free-text `unmatched_*` fields capture what
   the user says it is, with no FK at all. This keeps Garage useful on day one of that
   feature without making catalog completeness a blocker for letting someone add their
   car.

This table is not created now — V1 has no `garage_vehicles` table and no `auth.users`
dependency anywhere in the schema. It's included here, worked through in detail, because
the brief specifically asked to avoid redesigning vehicle identity after
user-generated content exists on top of it, and the only way to be confident about that
is to prove the reference pattern out before it's needed.

### 10.5 User market context vs. the catalog's GLOBAL spec region — default resolution for V1

This is a real V1 behavior (unlike §11, which is documented but not built) — it governs
what a Vehicle page actually shows today, so it's specified precisely here rather than
left as a future concern.

**Two different things, easy to conflate, that must stay distinct:**

- **The catalog's `spec_regions`** (`DATABASE_SCHEMA.md` §6) — `GLOBAL`, `US`, `EU`, and
  so on — is a technical/regulatory dimension of `vehicle_configurations`. `AM` is a
  *legitimate value in this table too*: not a business/country flag, but a spec region
  used whenever Lav Auto has entered and verified specifications that specifically
  represent what's typically found in the Armenian market (which may differ from a
  generic US- or EU-spec entry — different equipment, different figures). Adding an
  `AM` spec region costs nothing structurally; it's a seeded row, not a schema change.
- **The application's user market context** — for V1, a constant, not a stored
  preference: the `countries` row with `is_primary = true` (Armenia, §11.3). There is no
  market switcher UI in V1 and nothing is written to a cookie or session for it; it's
  read once, server-side, as the default input to the resolution algorithm below.

**Default resolution algorithm**, used whenever a Vehicle page, comparison entry, or
variant-overview "current configuration" is resolved *without* an explicit spec-region
override (which V1 never exposes in the UI, but the algorithm is written to accept one,
so turning on an override later — e.g. a diaspora user asking for US-spec figures — is
additive):

```
resolveConfiguration(variantId, modelYear, requestedSpecRegionCode?):
  preferredCode = requestedSpecRegionCode ?? userMarketContext.code   // 'AM' by default in V1
  1. Look for a vehicle_configuration matching
     (variantId, modelYear, spec_region.code = preferredCode)
     AND is_verified = true.
     → if found, return it, labeled with its actual spec_region code.
  2. Otherwise, fall back to
     (variantId, modelYear, spec_region.code = 'GLOBAL').
     → if found, return it (regardless of is_verified — GLOBAL is the documented
       reference fallback, not a claim about Armenia), labeled 'GLOBAL'.
  3. Otherwise, no configuration exists for that (variant, year) at all → 404 /
     not-found, same as today.
```

Verification is required for step 1 but not step 2 deliberately: an *unverified* `AM`
row is exactly the kind of not-yet-trustworthy entry that should never outrank a
verified `GLOBAL` fallback just because its region code matches the user's market —
that would be a subtler version of the "silently relabel GLOBAL as Armenian" mistake
this clarification exists to prevent. An unverified `AM` row simply isn't preferred over
`GLOBAL` yet; it becomes preferred once verified.

**The resolved spec region is always surfaced, never hidden.** Whatever
`resolveConfiguration` returns carries its own `spec_region.code`, and the Vehicle page
renders a translated, visible notice next to the specification table — e.g. "Armenia
specifications" when `AM` was verified-and-matched, or "Global reference specifications
— Armenia-specific data not yet available" when it fell back to `GLOBAL`. This is not
optional styling; it is the mechanism that satisfies "never silently relabel GLOBAL,
US, EU, or other market specifications as Armenian specifications." No component is
permitted to render a spec table without also rendering which region it resolved to.

**No spec region in the public URL in V1.** `/cars/bmw/3-series/g20/m340i-xdrive/2025`
resolves through the algorithm above with no query parameter needed, consistent with
§7.1's existing decision to keep spec region out of the URL until there's a concrete
UI need for switching it (the reserved `?spec=` param design in §7.1 already covers
that case — it isn't reopened here, just confirmed: this resolution logic is what
`?spec=` would override once it exists).

**This does not merge `spec_regions` and `countries`.** They remain separate tables for
the reasons in §11.2 — `spec_regions.code = 'AM'` and `countries.code = 'AM'` are two
different rows in two different tables that happen to share a code, joined only by this
one piece of application-level resolution logic (matching the user's market context's
code against a spec region's code), never by a foreign key. A future country whose code
doesn't have a corresponding curated spec region (e.g. if Lav Auto expands to a country
where it never enters region-specific specs) simply always falls through to `GLOBAL` at
step 2 — the algorithm degrades safely without any special-casing.

## 11. Market Availability & Pricing Architecture — Armenia-First (documented, not implemented)

Not part of V1's built schema (with one exception, §11.1 — `countries`). Documented in
full now, at the same level of detail as the rest of this review, because Armenia being
the primary market is a product decision that shapes the data model even before any of
this is built, and because getting the *separation* between these concerns right now is
what §9 decision 7 flags as expensive to unwind later.

### 11.1 Four concepts, kept structurally separate

The brief is explicit that these must not be coupled, and the schema reflects that as
four independent layers, each pointing at the one before it but never merged into it:

```
1. Global automotive identity/specs     makes → models → generations → variants →
                                         vehicle_configurations → spec_revisions
                                         (V1, built — see DATABASE_SCHEMA.md)
                                                    │
                                                    │ referenced by, never merged into
                                                    ▼
2. Armenian-market availability          vehicle_availability
                                         (variant + country + optional model_year →
                                          official / dealer / importer / used-market)
                                         (documented here, not built)
                                                    │
                                                    ▼
3. Armenian-market pricing               price_observations
                                         (configuration + country + price_type +
                                          currency + amount + source + observed_at)
                                         (documented here, not built)
                                                    │
                                                    ▼
4. Individual dealer/marketplace listings market_listings (§11.6 — dealer inventory
                                         and future marketplace observations, e.g.
                                         List.am/Auto.am, not built in Phase 1)
                                         (one specific for-sale unit: VIN, mileage,
                                          seller, location, asking price, status)
                                         (documented here, not built)
```

**A BMW M340i xDrive is a real, fully-specified catalog entry (layer 1) whether or not
a single example is currently for sale in Armenia (layers 2–4).** The Vehicle page in
V1 renders entirely from layer 1 and knows nothing about the other three — this is
already true today, not something that needs to change when layers 2–4 are built.
Layers 2–4 are additive reads joined *onto* a vehicle page later, never a rewrite of it.

### 11.2 Why availability and spec region are different axes (recap of §9 decision 7 / §10)

Armenia has no regulatory spec of its own — an Armenian-market car is always some other
region's spec import (commonly US-spec, EU-spec, or Russian-market-spec, depending on
the model and import route). So "is this available in Armenia" is never answered by
`vehicle_configurations.spec_region_id` — that column answers a different question
(whose regulatory figures the numbers reflect). Availability and pricing key off
`countries`, a table with zero relationship to `spec_regions` beyond both, coincidentally,
being "a place."

### 11.3 `countries` (built now — see `DATABASE_SCHEMA.md` §6.1)

The one piece of this section that *is* real V1 schema: a small lookup table, seeded
with a single row for Armenia (`AM`, currency `AMD`, `is_primary = true`). It exists now
because it's cheap, stable, and gives every future availability/pricing/business table
something real to reference, and because it makes "Armenia is the primary market" a
concrete, checkable fact in the schema rather than a claim only in this document. Adding
a second country later — Georgia, Russia, wherever Lav Auto expands next — is one insert
into this table. Nothing in layer 1 (the catalog) changes, and nothing in layers 2–4
needs restructuring: they were designed to be multi-country from the start, simply
unpopulated for anywhere but Armenia today.

### 11.4 `vehicle_availability` (documented, not built)

```sql
-- illustrative — NOT created in V1
create table vehicle_availability (
  id             bigint generated always as identity primary key,
  variant_id     bigint not null references variants(id),
  model_year     smallint,             -- null = classification applies generally, not year-specific
  country_id     bigint not null references countries(id),
  availability_type text not null check (availability_type in (
    'official',       -- officially offered by the manufacturer/authorized importer
    'dealer',          -- available through local dealers
    'importer',        -- commonly available through independent importers
    'used_market'      -- present in the used-car market, not sold new
  )),
  notes          text,
  source         text not null,
  observed_at    date not null,
  created_at     timestamptz not null default now(),
  unique (variant_id, model_year, country_id, availability_type)
);
```

- **Keyed at `variant_id` (+ optional `model_year`), not `vehicle_configuration_id`.**
  Availability knowledge is often coarser than exact-configuration knowledge — "the
  M340i xDrive is commonly brought in by importers" may be known and worth recording
  before anyone has entered a specific model year's configuration row. Requiring a
  configuration to exist first would block recording availability facts Lav Auto
  actually has.
- **No `not_available` row.** The absence of a row for a given `(variant, country)` is
  read as "not currently classified as available" — deliberately not distinguished in
  V1 from "confirmed unavailable," since that distinction is itself a data-collection
  maturity question, not a schema one. If it matters later, add the explicit type; it's
  one more allowed value in a check constraint, not a redesign.
- **Multiple rows can coexist** for the same variant/country — a model can be both
  `dealer` (new, through an authorized reseller) and `used_market` (older examples)
  simultaneously. This is intentional, not a data-quality bug.
- **Not populated in V1.** Doing so requires real, sourced knowledge of the Armenian
  market that doesn't exist yet in this project — the same "do not fabricate" principle
  that governs spec data (`DATABASE_SCHEMA.md` §5.1) applies here without exception.

### 11.5 Pricing: `price_types` + `price_observations` (documented, not built)

Generalizes what an earlier draft of this document called `msrp_history` into a shape
that covers every price type the brief lists, not just MSRP:

```sql
-- illustrative — NOT created in V1
create table price_types (
  id    bigint generated always as identity primary key,
  code  text not null unique,   -- 'official_msrp', 'dealer_price', 'promotional_price',
                                  -- 'new_market_price', 'used_asking_price',
                                  -- 'estimated_market_range'
  name  text not null
);

create table price_observations (
  id                        bigint generated always as identity primary key,
  vehicle_configuration_id  bigint not null references vehicle_configurations(id),
  country_id                bigint not null references countries(id),
  price_type_id             bigint not null references price_types(id),
  currency_code             text not null,        -- ISO 4217; 'AMD' for Armenian rows
  amount_minor_units        bigint not null,       -- store cents/luma, never a float
  amount_minor_units_high   bigint,                 -- nullable; only for range-style types
                                                      -- (e.g. 'estimated_market_range')
  source                    text not null,          -- required — no price row without one
  observed_at               timestamptz not null,   -- observation/effective date
  created_at                timestamptz not null default now()
);
```

This maps directly onto the dimensions requested for this review:

| Requested dimension | Where it lives |
|---|---|
| Market/country | `price_observations.country_id` |
| Currency | `price_observations.currency_code` (AMD for Armenia) |
| Vehicle/configuration | `price_observations.vehicle_configuration_id` |
| Model year | Implied by the configuration (a configuration is already variant × model year, §10) — not a separate column, to avoid two sources of truth for the same fact |
| Price type | `price_observations.price_type_id` → `price_types` |
| Source | `price_observations.source`, **required, not nullable** |
| Effective/observation date | `price_observations.observed_at` |

Design notes:

- **Time-series, not a single value, per country and price type.** MSRP changes
  (annual increases, mid-year adjustments); every price point is its own row, so
  "historical Armenian MSRP" is just "don't delete old rows," not a separate feature. A
  vehicle's *current* AMD price, wherever displayed, is a query (`price_type =
  official_msrp order by observed_at desc limit 1`), not a stored field anywhere.
- **AMD is the primary display currency for Armenia** by convention of
  `countries.currency_code` (§11.3), applied whenever `country_id` resolves to Armenia
  — this is configuration, not a hard-coded assumption anywhere in application code.
- **Currency stored as-is, never pre-converted.** `currency_code` + integer minor units
  travel together; if Lav Auto ever needs to show a US-sourced MSRP figure converted to
  AMD for context, that conversion happens at query/display time against a rates
  source, never baked into a stored row (rates change; a stored conversion goes stale
  silently). In practice, once this ships, Armenian rows should come from Armenian
  sources (dealer quotes, market observation) rather than a converted foreign MSRP —
  converting a US or EU MSRP is not the same number as what a car actually costs to buy
  in Armenia (duties, import costs, local demand), and doing so would violate the "do
  not fabricate" principle just as surely as inventing a spec value would.
- **`source` is required, not optional, by design.** The brief states "all production
  pricing must eventually have a source and timestamp" — modeled as a `not null`
  constraint, not a convention someone can forget to follow. `observed_at` is `not
  null` for the same reason.
- **Dealer/promotional/used-asking prices are still `price_observations` rows when
  they're aggregate market signals** (e.g. "typical dealer price for this configuration
  in Armenia, as observed"), but an **individual dealer's live listing for one specific
  physical car is not** — that's layer 4 (§11.6), a fundamentally different kind of
  record (has a status, expires, belongs to one business).

### 11.6 Market listings (layer 4) — dealer inventory *and* future marketplace observations

Broadened from an earlier draft that only covered dealer inventory: the brief's
Armenian-market layer also anticipates individual marketplace listings (e.g. List.am,
Auto.am — **not built in Phase 1, explicitly deferred**) alongside registered-dealer
inventory. Both are "one specific car someone is asking money for, right now," so they
share a shape; a listing without a Lav Auto business behind it (a marketplace
observation) simply has `business_id = null`.

```sql
-- illustrative — NOT created in V1. Dealer-sourced rows depend on a future
-- `businesses` table; marketplace-sourced rows depend only on `data_sources` (§8),
-- which already exists.
create table market_listings (
  id                        bigint generated always as identity primary key,
  business_id               bigint references businesses(id),  -- null for a marketplace observation not tied to a registered dealer
  data_source_id            bigint references data_sources(id),  -- e.g. a future 'list_am'/'auto_am' row (§8); null for a dealer's own listing
  vehicle_configuration_id  bigint references vehicle_configurations(id),  -- nullable: see §10.4's fallback pattern, same idea applies to inventory
  country_id                bigint not null references countries(id),
  condition                 text not null check (condition in ('new', 'used')),
  vin                       text,
  mileage_km                integer,
  seller_type               text not null check (seller_type in ('dealer', 'private', 'unknown')),
  seller_name               text,
  location_text             text,               -- free-text city/region; not modeled as a full geo table in V1
  listing_url               text,
  price_currency_code       text not null,
  price_amount_minor_units  bigint not null,
  status                    text not null check (status in ('available', 'pending', 'sold', 'expired')),
  listed_at                 timestamptz not null,
  observed_at               timestamptz not null default now(),  -- last time this row was confirmed still accurate
  updated_at                timestamptz not null default now(),
  check (business_id is not null or data_source_id is not null)
);
```

This is exactly the set of fields the brief calls out as Armenian-market observations
that must stay out of the canonical technical specification tables — asking price,
mileage, listing date, seller, location, availability — all live here, all pointing
*into* the catalog via `vehicle_configuration_id`, never the other way around.

Kept separate from `price_observations` because listings have a lifecycle
(`available → pending → sold`/`expired`) and a concrete origin (one business's own
inventory, or one external marketplace source) that aggregate price observations
don't — merging them would force every aggregate market-price row to pretend it
belongs to a business or source, or every listing to pretend it's just a data point.
RLS, once this exists, differs by origin too: a dealer can write only their own
`business_id` rows; marketplace-sourced rows are written only by a future ingestion
job using the service role, same pattern as the catalog itself (§12).

## 12. Provider-Independent Ingestion Architecture

Lav Auto must not depend structurally on any single automotive data API. During
development that means NHTSA vPIC and/or manually verified data; later, a more
comprehensive commercial provider; separately, future Armenian-market sources
(marketplace/dealer feeds — not built in Phase 1). Switching or adding a provider must
never require changing a canonical ID, a vehicle URL, or a future FK from
Garage/reviews/clubs/posts.

### 12.1 What already guarantees this

Most of the work was already done by decisions made earlier in this document, not by a
new mechanism:

- Every catalog table's primary key is `bigint generated always as identity` — Lav
  Auto's own sequence, never a provider's ID (`DATABASE_SCHEMA.md` §2–§7).
- Every `slug` is assigned once, by Lav Auto, at data-entry time, and is never
  auto-regenerated from a provider's naming (§9 decision 1). A provider renaming or
  restructuring its own catalog has no effect on a Lav Auto URL.
- No catalog table has an `nhtsa_id`, `provider_ref`, or similar column mixed into its
  identity columns. Provider IDs live in exactly one place: `external_source_mappings`
  (`DATABASE_SCHEMA.md` §8), a side table that records provenance without participating
  in identity.

The one thing that needed adding was that mapping table, plus the discipline described
below for how data crosses from "provider's format" to "Lav Auto's canonical rows."

### 12.2 The ingestion/adapter layer

```
Provider response (NHTSA JSON, a future provider's format, ...)
            │
            ▼
   lib/ingestion/adapters/<source>.ts      ← the ONLY code that knows the
   (implements CatalogIngestionAdapter)       provider's response shape
            │  produces canonical insert/update inputs
            │  (Make, Model, Generation, Variant, VehicleConfiguration, SpecInput, ...)
            ▼
   lib/data/*  (the same repository layer the app reads through)
            │  writes canonical rows + one external_source_mappings row per entity
            ▼
        PostgreSQL (canonical schema, DATABASE_SCHEMA.md)
            │
            ▼
   UI components (Vehicle page, comparison, etc.) — read lib/data/*, never see
   a provider's response shape at all
```

- **One adapter module per external source**, each implementing a shared
  `CatalogIngestionAdapter` interface (`lib/ingestion/types.ts`) that returns data
  already reshaped into Lav Auto's own input types — a make, a model, a spec value —
  never the provider's raw field names or structure. This is what makes "UI components
  must never directly depend on a provider's response format" true: nothing outside the
  one adapter file ever sees NHTSA's (or anyone else's) JSON shape.
- **Adapters write through `lib/data/*`, the same repository layer the app reads
  through** — never direct SQL, never a separate ingestion database connection. There
  is exactly one code path for "how a row gets into the catalog," whether it was typed
  by a developer in a seed script or produced by a future adapter.
- **Every canonical row an adapter creates or updates gets a matching
  `external_source_mappings` row** (`entity_type`, the canonical `entity_id`,
  `external_id`, `fetched_at`, optionally `raw_payload`). Re-running an adapter looks up
  the existing mapping first (via the `(data_source_id, entity_type, external_id)`
  unique constraint) to decide update-vs-insert, rather than guessing by name/slug
  matching — name matching across providers is exactly the kind of fragile heuristic
  this layer exists to avoid.
- **Not a microservice, not a queue, not a scheduler.** An adapter is a plain
  TypeScript module, run via a script (`scripts/ingest/<source>.ts`, invoked manually
  or — later — by a scheduled job) inside the same Next.js codebase. There is no
  separate ingestion service, no message broker, no independent deployment. This is
  the "simple internal ingestion/adapter architecture" the requirement asks for; a
  microservice would be solving a scale problem Lav Auto doesn't have yet.

### 12.3 What Phase 1 actually builds here, and what it doesn't

- **Builds:** the `data_sources` / `external_source_mappings` tables (real V1 schema,
  `DATABASE_SCHEMA.md` §8) and the `CatalogIngestionAdapter` interface/types in
  `lib/ingestion/types.ts` (a contract for future adapters to implement against).
- **Does not build:** an actual NHTSA vPIC adapter, or any bulk import. Phase 1's
  dataset is a small, hand-entered development fixture (`docs/IMPLEMENTATION_PLAN.md`),
  inserted directly via seed SQL and tagged with a `manual_verified`/`editorial`
  `data_sources` row — itself a valid, if trivial, "source" in the same provenance
  system a future NHTSA adapter will use. Writing a real adapter is deferred until
  bulk/automated ingestion is actually scheduled, so the interface isn't designed
  against a hypothetical shape before a real one is known.

### 12.4 Replacing or adding a provider later

Because nothing above ties a canonical ID, URL, or future FK to a provider: adding a
comprehensive commercial provider alongside (or instead of) NHTSA is a new adapter
module plus a new `data_sources` row. Re-pointing which source is treated as
authoritative for a given field is an ingestion-layer/editorial decision (e.g., "prefer
`is_verified = true` rows over freshly-imported ones," already expressible via
`spec_revisions.is_verified`), not a schema or URL change. The same is true for the
future Armenian-market sources — a `list_am` or `auto_am` `data_sources` row and an
adapter producing `market_listings` rows (§11.6) — which don't touch the catalog at all.

## 13. What This Document Deliberately Does Not Cover

- Any UI visual design/component library choice beyond Tailwind — that's implementation
  detail, not architecture.
- The production automotive data source/API — explicitly deferred per the brief ("will
  be selected separately").
- Any of the long-term feature systems in §8 beyond how the schema stays open to them.
- Real Armenian availability or pricing data, or how/where it will be sourced — §11
  designs the shape only; sourcing real, verifiable Armenian market data is a future,
  separate effort, not something this review fabricates a starting dataset for.
- Any Armenian dealer/mechanic/detailer/tuner/parts-business product feature — out of
  scope for the same reason the rest of the long-term feature list is (§8); §11 only
  ensures the vehicle/market model won't need restructuring when that work starts.
