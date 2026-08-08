# Lav Auto — Phased V1 Implementation Plan

Each phase should be reviewable/mergeable on its own. No phase implements anything from
the long-term feature list (§ "Future Platform Evolution" in `ARCHITECTURE.md`).

## Phase 0 — Foundations

- Scaffold Next.js (App Router) + TypeScript (`strict: true`) + Tailwind CSS.
- Set up ESLint/Prettier, base `tsconfig.json`, environment variable handling
  (`.env.local.example` documenting `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server-only, never
  exposed to the client).
- Create the Supabase project; wire `lib/supabase/server.ts` and `lib/supabase/client.ts`.
- Install and configure `next-intl`; get `/en`, `/hy`, `/ru` resolving to a placeholder
  page with a working locale switcher, before any real content exists — proves the i18n
  routing decision (§9.4 in `ARCHITECTURE.md`) end-to-end early, since it's expensive to
  change later.
- Base layout, empty `messages/{en,hy,ru}.json` with a `common` namespace.

**Exit criteria:** app boots on Vercel preview, all three locales route correctly,
Supabase client connects.

## Phase 1 — Database & Data Access Layer

- Write the migrations for every table in `DATABASE_SCHEMA.md` (hierarchy, lookups
  including `spec_regions` and `countries`, spec category tables, images), with RLS
  policies from the start.
- Seed `countries` with Armenia (`AM`, currency `AMD`, `is_primary = true`) — the only
  Armenia-first schema addition that's real V1 data; nothing else in §11 of
  `ARCHITECTURE.md` is built yet.
- Write `supabase/seed/dev-seed.sql`: a small, clearly-labeled development dataset —
  enough to exercise every relationship, specifically including the scenario from
  `ARCHITECTURE.md` §10.3: at minimum one variant with (a) multiple model years sharing
  one spec revision (proves de-duplication), (b) a year where the spec revision changes
  (proves facelift/mid-cycle handling), and (c) two spec regions for the same model
  year with different spec revisions (proves spec-region differentiation) — plus a
  couple of shared engines reused across configurations. No fabricated numbers
  presented as real, and — per the Armenia-first review — no fabricated Armenian
  availability or pricing rows either, since neither table exists yet.
- Generate TypeScript types from the schema (`supabase gen types typescript`).
- Build `lib/data/*` repository functions (`getMakeBySlug`, `listModelsForMake`,
  `getGenerationBySlug`, `listConfigurationsForVariant`,
  `resolveConfiguration(variantSlug, year, specRegion?)`, etc.), fully typed, with no
  query logic living anywhere outside this layer. `resolveConfiguration` implements the
  default resolution algorithm from `ARCHITECTURE.md` §10.5 (prefer a verified
  configuration matching the user's market context, Armenia by default; fall back to
  `GLOBAL`) and returns the resolved `specRegionCode`/`isVerified` alongside the
  configuration — never just the configuration, since the caller must always be able to
  render which region the data came from.
- Zod schemas for anything crossing a boundary (route/search params, including the
  `year` route param and the `v=slug.year` compare param format).
- Seed `spec_regions` with `GLOBAL` plus the codes exercised by the dev seed dataset
  above (e.g. `US`, `EU`). Do **not** seed a verified `AM` `vehicle_configurations` row
  in the shared dev seed — a "verified" but fabricated Armenia row is exactly the kind
  of mislabeling `ARCHITECTURE.md` §10.5 exists to prevent, even in a dev database.
  Exercise the AM-preferred branch of `resolveConfiguration` with an isolated test
  fixture instead (inserted and rolled back within a test), not shared seed data.

**Exit criteria:** repository functions can fetch a full vehicle configuration (variant
+ year + all spec categories) in a typed shape, with `resolveConfiguration`'s
GLOBAL-fallback path verified against the seed data and its AM-preferred path verified
against an isolated test fixture — before any UI exists.

## Phase 2 — Core Browsing Pages

- Manufacturer page (`/cars/[make]`): list models, empty state if a make has no models
  yet, loading/error states.
- Model page (`/cars/[make]/[model]`): list generations.
- Generation page (`/cars/[make]/[model]/[generation]`): list variants.
- Variant overview page (`/cars/[make]/[model]/[generation]/[variant]`): lists
  available model years for the trim, features the current/latest one — see
  `ARCHITECTURE.md` §7.1.
- Vehicle page (`/cars/[make]/[model]/[generation]/[variant]/[year]`): identity block,
  image, generated summary, specs grouped by category
  (`SpecCategoryGroup`/`SpecTable`), "Add to Comparison" button (UI only — wired to the
  store in Phase 4). Resolves via `resolveConfiguration` (§10.5); renders a mandatory
  `SpecDataSourceNotice` next to the spec table showing which region the displayed data
  resolved to (`specs.dataSource.am` / `specs.dataSource.global`, see
  `LOCALIZATION.md`) — never omitted, never hardcoded to "Armenia." Also renders a
  "specs carried over from the previous model year" note when the resolved spec
  revision is shared with the prior year's configuration.
- `generateMetadata` + JSON-LD on all of the above; `generateStaticParams` + ISR.
- Real translation keys for every string introduced (no more scaffolding placeholders).
- Home page: static/curated "Popular Manufacturers" and "Popular Comparisons" sections
  (see `ARCHITECTURE.md` §2 risk #4 — curated, not computed, in V1), plus the selector
  chain (Make → Model → Generation → Variant) as a client component driving navigation.

**Exit criteria:** every catalog URL in the brief's examples resolves to a real,
localized, SEO-metadata'd page using only seed data.

## Phase 3 — Search

- Postgres `pg_trgm`-backed search function/RPC across make/model/variant names.
- `SearchBar` component (Home + a persistent header instance), debounced, accessible
  (keyboard navigable results, proper ARIA roles).
- `/api/search` route handler as a thin wrapper over `lib/data/search.ts`.
- Loading/empty ("no results for X") states.

**Exit criteria:** typing a make, model, or trim name returns relevant matches and
navigates to the right catalog page.

## Phase 4 — Comparison

- Zustand store with `persist` (localStorage), capped at 3 entries, per
  `COMPARISON_STATE.md`.
- `CompareTray` (floating, site-wide, mobile-collapsing bottom bar).
- Wire `AddToCompareButton` on manufacturer/model/generation/vehicle pages to the store.
- `/compare` page: reads `searchParams`, resolves each `v=slug.year` entry to a
  vehicle configuration via the repository layer, renders `CompareTable` grouped by
  spec category with difference highlighting.
- Mobile layout: swipeable per-vehicle cards instead of a shrinking grid.
- Empty state (0–1 vehicles selected) and partial-failure handling (invalid/missing
  slug in the URL).

**Exit criteria:** a user can add vehicles from anywhere in the catalog, see a live
count, reach `/compare`, and share the resulting URL to reproduce the same comparison
cold.

## Phase 5 — Polish & Hardening

- Accessibility pass: keyboard navigation through selectors/search/compare, color
  contrast, semantic headings, focus management, screen-reader labels for icon-only
  controls.
- Responsive QA across common breakpoints, with real device/emulator checks for the
  comparison table specifically (it's the highest-risk layout for mobile).
- Unit-system toggle (metric/imperial) wired end-to-end through `lib/units/*`, verified
  against every spec category that has convertible fields.
- SEO audit: sitemap.ts/robots.ts correctness, hreflang alternates on every locale,
  Lighthouse pass on representative pages.
- Error boundaries and consistent loading/empty/error states audited across all pages
  (brief explicitly requires all three).
- i18n completeness check (no missing keys across `en`/`hy`/`ru`).

**Exit criteria:** Lighthouse/accessibility scores in an acceptable range on
manufacturer/model/generation/vehicle/compare pages in all three locales.

## Phase 6 — Launch Readiness

- Environment variable and secrets review (service role key never reachable from client
  bundles — verify via build output inspection, not just code review).
- Confirm RLS policies match `DATABASE_SCHEMA.md` §9 exactly (read-only, no anon
  write path) directly against the deployed database, not just the migration files.
- Deploy to Vercel (production project), verify ISR revalidation behavior in production.
- Smoke test: every page type, all three locales, mobile + desktop viewport, search,
  and a full add-to-compare-and-share round trip.
- Update `docs/` if anything changed materially from the plan during implementation.

**Exit criteria:** V1 as scoped in the brief is live and verifiable end-to-end, with
nothing from the long-term feature list implemented.

## Phase 7 — Armenian Market Data Layer (near-term follow-up, not V1, not built now)

Called out separately from the long-term "out of scope" list below because, unlike
garages/clubs/social, this is core to Lav Auto's stated Armenia-first positioning and
is likely the right *next* body of work once V1 ships — not a someday feature. Not
started until real, sourced Armenian data collection is in place, per
`ARCHITECTURE.md` §11:

- Build `vehicle_availability`, `price_types`, and `price_observations` (schema
  designed in `ARCHITECTURE.md` §11.4–11.5; not created in earlier phases).
- Establish real data sourcing for Armenian availability/pricing (partner dealers,
  manual research, an eventual data feed) — explicitly not fabricated or estimated by
  Lav Auto itself.
- Surface availability/AMD pricing on the Vehicle page as an additive read (per §11.1,
  layer 1 rendering doesn't change; this becomes a new section on an existing page).
- Only after this: dealer/importer business profiles and listing inventory (§11.6),
  which depend on both this phase and the future `businesses`/accounts subsystem.

## Explicitly out of scope for all of the above

Accounts/auth, garages, vehicle ownership, photos/builds/mods, social posts, follows,
clubs, local communities, dealers/mechanics/detailers/tuners/parts businesses, business
profiles, local service discovery, reviews, quizzes, achievements/points, sponsored
rewards, advertising, events, notifications, messaging. See `ARCHITECTURE.md` §8 for how
each attaches to this foundation when its time comes, and §11 specifically for the
Armenian availability/pricing/dealer-listing shape.
