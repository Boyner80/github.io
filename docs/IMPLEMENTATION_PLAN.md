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

- Write the migrations for every table in `DATABASE_SCHEMA.md` (hierarchy, lookups,
  spec category tables, images), with RLS policies from the start.
- Write `supabase/seed/dev-seed.sql`: a small, clearly-labeled development dataset —
  enough to exercise every relationship (at minimum: 2 makes, 2–3 models, a couple of
  generations each, 2–4 variants per generation, at least one variant with two spec
  revisions to prove the effective-dating works, a couple of shared engines reused
  across variants). No fabricated numbers presented as real — seed comment header states
  this is placeholder/test data.
- Generate TypeScript types from the schema (`supabase gen types typescript`).
- Build `lib/data/*` repository functions (`getMakeBySlug`, `listModelsForMake`,
  `getGenerationBySlug`, `getVariantWithSpecs`, etc.), fully typed, with no query logic
  living anywhere outside this layer.
- Zod schemas for anything crossing a boundary (route/search params).

**Exit criteria:** repository functions can fetch a full vehicle (variant + all spec
categories) in a typed shape, verified by a small script/test — before any UI exists.

## Phase 2 — Core Browsing Pages

- Manufacturer page (`/cars/[make]`): list models, empty state if a make has no models
  yet, loading/error states.
- Model page (`/cars/[make]/[model]`): list generations.
- Generation page (`/cars/[make]/[model]/[generation]`): list variants.
- Vehicle page (`/cars/[make]/[model]/[generation]/[variant]`): identity block, image,
  generated summary, specs grouped by category (`SpecCategoryGroup`/`SpecTable`),
  "Add to Comparison" button (UI only — wired to the store in Phase 4).
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
- `/compare` page: reads `searchParams`, resolves variants via the repository layer,
  renders `CompareTable` grouped by spec category with difference highlighting.
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
- Confirm RLS policies match `DATABASE_SCHEMA.md` §8 exactly (read-only, no anon
  write path) directly against the deployed database, not just the migration files.
- Deploy to Vercel (production project), verify ISR revalidation behavior in production.
- Smoke test: every page type, all three locales, mobile + desktop viewport, search,
  and a full add-to-compare-and-share round trip.
- Update `docs/` if anything changed materially from the plan during implementation.

**Exit criteria:** V1 as scoped in the brief is live and verifiable end-to-end, with
nothing from the long-term feature list implemented.

## Explicitly out of scope for all of the above

Accounts/auth, garages, vehicle ownership, photos/builds/mods, social posts, follows,
clubs, local communities, dealers/mechanics/detailers/tuners/parts businesses, business
profiles, local service discovery, reviews, quizzes, achievements/points, sponsored
rewards, advertising, events, notifications, messaging, pricing data. See
`ARCHITECTURE.md` §8 for how each attaches to this foundation when its time comes.
