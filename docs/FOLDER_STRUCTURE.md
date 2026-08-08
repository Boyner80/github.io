# Lav Auto — Proposed Folder Structure

Next.js App Router, TypeScript, one locale-prefixed route tree. Structure favors a small
number of clear layers (routing / components / data-access / cross-cutting libs) over
premature feature-module splitting — with ~5 page types in V1, a heavier structure would
be overengineering per the brief.

```
lav-auto/
├─ app/
│  ├─ [locale]/
│  │  ├─ layout.tsx                 # sets <html lang>, loads messages, providers
│  │  ├─ page.tsx                   # Home: search, selectors, popular makes/comparisons
│  │  ├─ loading.tsx / error.tsx    # root-level loading & error boundaries
│  │  ├─ cars/
│  │  │  └─ [make]/
│  │  │     ├─ page.tsx             # Manufacturer page: /cars/bmw
│  │  │     ├─ loading.tsx
│  │  │     ├─ not-found.tsx
│  │  │     └─ [model]/
│  │  │        ├─ page.tsx          # Model page: /cars/bmw/3-series
│  │  │        └─ [generation]/
│  │  │           ├─ page.tsx       # Generation page: /cars/bmw/3-series/g20
│  │  │           └─ [variant]/
│  │  │              ├─ page.tsx    # Vehicle page: /cars/bmw/3-series/g20/m340i-xdrive
│  │  │              └─ loading.tsx
│  │  └─ compare/
│  │     ├─ page.tsx                # /compare — reads selection from searchParams
│  │     └─ loading.tsx
│  ├─ api/
│  │  └─ search/
│  │     └─ route.ts                # thin handler around the search repository fn
│  ├─ sitemap.ts                    # generated from the catalog repository layer
│  ├─ robots.ts
│  └─ globals.css
│
├─ components/
│  ├─ ui/                           # generic, no domain knowledge (Button, Input, Select, Card, Skeleton)
│  ├─ layout/                       # Header, Footer, LocaleSwitcher, UnitToggle
│  ├─ vehicle/
│  │  ├─ VehicleCard.tsx
│  │  ├─ VehicleIdentity.tsx        # name/image/summary block, shared by vehicle page & compare
│  │  ├─ SpecTable.tsx              # renders one spec category, given translated labels
│  │  ├─ SpecCategoryGroup.tsx
│  │  └─ AddToCompareButton.tsx
│  ├─ selectors/
│  │  ├─ MakeSelect.tsx
│  │  ├─ ModelSelect.tsx
│  │  ├─ GenerationSelect.tsx
│  │  └─ VariantSelect.tsx
│  ├─ search/
│  │  └─ SearchBar.tsx
│  └─ compare/
│     ├─ CompareTray.tsx            # floating "Compare (2)" bar, client component
│     └─ CompareTable.tsx           # side-by-side grouped spec table, mobile-aware
│
├─ lib/
│  ├─ data/                         # the ONLY layer that talks to Postgres/Supabase
│  │  ├─ makes.ts                   # getMakeBySlug, listMakes, ...
│  │  ├─ models.ts
│  │  ├─ generations.ts
│  │  ├─ variants.ts
│  │  ├─ specs.ts                   # fetch + shape grouped specs for a variant
│  │  ├─ images.ts                  # provider-agnostic image resolution
│  │  ├─ search.ts
│  │  └─ types.ts                   # domain types returned by the repository layer
│  ├─ supabase/
│  │  ├─ server.ts                  # server-side client (RSC/route handlers)
│  │  └─ client.ts                  # browser client (only where a client component needs it)
│  ├─ units/
│  │  ├─ length.ts                  # mm <-> in, km/h <-> mph
│  │  ├─ mass.ts                    # kg <-> lb
│  │  ├─ torque.ts                  # Nm <-> lb-ft
│  │  ├─ economy.ts                 # L/100km <-> MPG
│  │  └─ index.ts
│  ├─ i18n/
│  │  ├─ routing.ts                 # next-intl locale config (en/hy/ru, default locale)
│  │  ├─ request.ts                 # next-intl request config
│  │  └─ navigation.ts              # typed Link/useRouter wrappers aware of locale
│  ├─ validation/
│  │  └─ *.ts                       # zod schemas: search params, compare selection, etc.
│  └─ utils/
│     └─ slug.ts, format.ts, ...
│
├─ types/
│  └─ supabase.ts                   # generated via `supabase gen types typescript`
│
├─ messages/
│  ├─ en.json
│  ├─ hy.json
│  └─ ru.json
│
├─ supabase/
│  ├─ migrations/                   # timestamped SQL migrations (schema in DATABASE_SCHEMA.md)
│  └─ seed/
│     └─ dev-seed.sql               # small, clearly-marked development/test dataset
│
├─ docs/                            # this documentation
│
├─ middleware.ts                    # next-intl locale detection/redirect
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json                    # strict: true
└─ package.json
```

## Rules this structure is meant to enforce

- **`lib/data/*` is the only place that imports a Supabase client.** Components and
  pages call repository functions and receive typed domain objects — this is what keeps
  the ingestion/data-source swap (brief requirement) realistic.
- **No hard-coded vehicle data in components.** Anything that looks like "BMW", "M340i",
  a spec number, or a spec label in a `.tsx` file outside of test/seed data is a bug —
  it belongs in the database or, for enum labels, in `messages/*.json`.
- **No hard-coded UI strings in components.** Every user-facing string goes through
  `useTranslations`/`getTranslations` from `next-intl`. See `LOCALIZATION.md`.
- **`components/ui` never imports `lib/data`.** Generic components stay reusable across
  future features (garage, business profiles, etc.) precisely by staying ignorant of the
  automotive domain.
- Feature areas that don't exist yet (garage, social, businesses) get their own sibling
  directories under `app/[locale]/` and `lib/data/` when they're built — nothing above
  needs to be reshuffled to make room for them.
