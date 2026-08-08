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
| 1 | Vehicle page URL needs to support real, high-volume search intent like "2025 BMW M340i xDrive specs," and specs can differ meaningfully by model year within a trim. | **Revised after architecture review** (see §10): model year is a required path segment — `/cars/bmw/3-series/g20/m340i-xdrive/2025`. It resolves to a `vehicle_configurations` row, the new stable per-year identity introduced in this revision. The year-less path (`/cars/bmw/3-series/g20/m340i-xdrive`) is a real, separately-indexable overview page listing available years, not a redirect. See §10 for the full identity model and §7 for the URL strategy. |
| 2 | Specs can also differ by market/region (US vs EU headlights, mph vs km/h source figures; a 2024 US M340i xDrive and a 2024 EU M340i xDrive share a name but differ in numbers). | **Revised after architecture review** (see §10): market is a first-class column on `vehicle_configurations` (not nullable — a seeded `GLOBAL` market row is used for undifferentiated data), so the identity model already distinguishes market internally. V1 UI still shows one market per catalog entry and does not expose market switching; when it's added, it's a query-param refinement (`?market=EU`) on top of an already-correct schema, not a schema change. |
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
- **Market is not a path segment in V1.** Unlike model year, market is not part of the
  brief's V1 UI scope and most users never need to think about it. It is modeled as a
  query parameter (`?market=EU`) reserved for a later phase, defaulting to the single
  market a given configuration's data represents (see `GLOBAL` market row,
  `DATABASE_SCHEMA.md` §6). Because `vehicle_configurations` already separates market
  as a real column (§10), turning this on later is additive — no data model change,
  just a new route parameter and a market switcher component.

## 8. Future Platform Evolution

The brief lists a large long-term feature set. None of it is built now. This section
exists to show the current design doesn't block it.

| Future system | How it attaches without redesigning V1 |
|---|---|
| User accounts / profiles | Supabase Auth, additive. RLS policies added to *new* tables only; catalog tables stay public-read. |
| Personal virtual garage / owned vehicles | New `garage_vehicles` table referencing **`vehicle_configurations`** — the precise, per-year, per-market identity (see §10) — not `variants`. Full reference pattern, including what happens when the user's exact configuration isn't in the catalog, is worked out in §10.4. |
| Vehicle photos / builds / modifications | New tables FK'd to `garage_vehicles`. Independent of the catalog `vehicle_images` table (which holds *stock/reference* images, not user uploads). Supabase Storage buckets, separate from whatever provider serves catalog images. |
| Social posts, following | New `posts`, `follows` tables FK'd to `auth.users`. Optionally `posts.variant_id` (coarse — "posted about the M340i xDrive generally") or `posts.vehicle_configuration_id` (precise — "posted about my specific 2024") depending on the post type. |
| Make/model clubs, local communities | New `clubs` table, optionally FK'd to `models` (make/model-specific) — the normalized make/model tables already support this join cleanly; a flat `cars` table would not have. Clubs are deliberately scoped at the `variant`/`model` level, not per-configuration — "M340i xDrive owners," not "2024 US M340i xDrive owners." |
| Dealers, mechanics, detailers, tuners, parts businesses | New `businesses` table family, independent of the catalog. Vehicle inventory/listings reference `vehicle_configurations` (a listing is for a specific year/market car, priced accordingly — see §11), not a duplicated business-owned copy of spec data. |
| Reviews | New `reviews` table FK'd to `vehicle_configuration_id` (+ optionally `garage_vehicle_id` for verified-owner reviews) and `user_id`. Configuration-level, not variant-level, because a review of "the 2024 pre-facelift" and "the 2025 facelifted" car may legitimately disagree. |
| Quizzes / achievements / points / sponsored rewards | New, fully independent tables; may reference `makes`/`models`/`variants` for quiz content but need nothing from them structurally. |
| Business advertising, events, notifications, messaging | New subsystems with no FK dependency on the catalog at all. |
| Pricing (MSRP, dealer, used-market) | Not modeled at all in V1 — see §11 for the intended future shape and why nothing here assumes a single price. |

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

## 11. Pricing Architecture (documented, not implemented)

Not part of V1. Documented now so nothing added later has to unwind an assumption baked
in earlier — specifically, **no table anywhere in this schema has a `price` column**,
and none should be added without going through this shape.

Pricing is inherently: time-varying, multi-currency, market-scoped, and multi-source
(manufacturer MSRP vs. an individual dealer's asking price vs. used-market value are
three different things with three different owners and lifecycles). A single `price`
column on any catalog table would be wrong on all four counts simultaneously.

```sql
-- illustrative — NOT created in V1
create table msrp_history (
  id                        bigint generated always as identity primary key,
  vehicle_configuration_id  bigint not null references vehicle_configurations(id),
  currency_code             text not null,      -- ISO 4217, e.g. 'USD'
  amount_minor_units        bigint not null,     -- store cents, never a float
  effective_date            date not null,
  source                    text,
  created_at                timestamptz not null default now()
);
```

- **Time-series, not a single value.** MSRP changes (annual increases, mid-year
  adjustments); every price point is its own row, so "historical MSRP" is just "don't
  delete old rows," not a separate feature.
- **Market comes from the join, not a duplicated column.** `vehicle_configuration_id`
  already encodes market (§10), so an MSRP row is automatically market-scoped without
  repeating that information.
- **Currency stored as-is, never pre-converted.** `currency_code` + integer minor units
  (cents) travel together; FX conversion, if ever needed for display, happens at query
  time against a rates source, not by baking a converted value into storage (rates
  change; a stored conversion would silently go stale).
- **Dealer pricing and used-market pricing are separate concerns, not variations of
  MSRP.** Dealer pricing belongs to the future `businesses` subsystem (§8) —
  illustratively a `dealer_listings` table (`dealer_id`, `vehicle_configuration_id`,
  `price`, `condition`, `mileage`, `listed_at`) with its own RLS (a dealer can only
  write their own listings) and its own churn rate (listings expire; MSRP doesn't).
  Used-market pricing is likely sourced from a third-party valuation feed later — a
  `market_value_estimates` table or an external API call, not something computed from
  MSRP internally.

## 12. What This Document Deliberately Does Not Cover

- Any UI visual design/component library choice beyond Tailwind — that's implementation
  detail, not architecture.
- The production automotive data source/API — explicitly deferred per the brief ("will
  be selected separately").
- Any of the long-term feature systems in §8 beyond how the schema stays open to them.
