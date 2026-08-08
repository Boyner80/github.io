# Lav Auto — Comparison State Design

## Constraints

- No user accounts in V1 — comparison state cannot live server-side per-user.
- 2–3 vehicles, side-by-side, must work well on mobile.
- Comparison should be shareable (brief implies a normal product expectation even
  though it isn't stated outright — a comparison link with nothing in the URL isn't
  shareable) and the `/compare` page itself should be usable from a cold link, not only
  by navigating there from a vehicle page.

## Design

Two cooperating pieces of state, kept deliberately separate:

1. **The `/compare` page's source of truth is the URL.** Selected variants are encoded
   as repeated query params: `/compare?v=bmw.3-series.g20.m340i-xdrive&v=audi.a4.b9.s4`.
   Using the slug path (not a numeric ID) keeps the URL human-readable and stable
   against ID changes. This makes `/compare` a normal server-renderable page:
   `page.tsx` reads `searchParams`, resolves each `v` to a variant via the repository
   layer, and renders the comparison — no client-only rendering required for the core
   view, and the URL alone is enough to reproduce a comparison (link-shareable, and
   revisitable after a refresh).

2. **A lightweight client store (Zustand + `persist` → localStorage) tracks "vehicles
   currently queued for comparison"** so an "Add to Comparison" button on a manufacturer,
   model, generation, or vehicle page can build up a selection *before* the user
   navigates to `/compare`, and a floating `CompareTray` component (visible site-wide)
   shows the current count/preview. Navigating to "Compare" writes the store's contents
   into the URL query params described above — at that point the URL takes over as the
   source of truth for that page load.

```
Any catalog page
  [Add to Compare] → Zustand store (persisted to localStorage, max 3 entries)
                          │
                          ▼
                  CompareTray (floating, site-wide, client component)
                          │  click "Compare"
                          ▼
             navigate to /compare?v=...&v=...  (store contents → URL)
                          │
                          ▼
        /compare page.tsx reads searchParams (server component)
                          │
                          ▼
        resolves each `v` via lib/data/variants.ts, renders CompareTable
```

## Why not just the store, or just the URL?

- **Store only** (no URL sync): `/compare` would only work after navigating from within
  the same browser session — a shared or bookmarked link would land on an empty page.
  Fails the shareability expectation and isn't SEO/SSR-friendly.
- **URL only** (no client store): every "Add to Compare" click on a listing page would
  need to rewrite the current page's URL or do a client-side redirect just to hold
  state, and there'd be no persistent "you have 2 vehicles queued" indicator while
  browsing — worse UX for the core mobile flow of browsing several models and adding
  them one at a time.

Using both, with the store feeding the URL only at the point of navigating to
`/compare`, keeps each piece doing the job it's actually good at.

## Mobile behavior

- Below a breakpoint, `CompareTable` switches from a side-by-side grid to a
  horizontally-swipeable card-per-vehicle layout with category headers as sticky rows,
  rather than shrinking columns until they're unreadable. This is a component-level
  responsive decision (`CompareTable.tsx`), not a separate route/page.
- The `CompareTray` collapses to a small fixed bottom bar on mobile (count + "Compare"
  button), never a modal that blocks the page.

## Limits & validation

- Hard cap of 3 vehicles, enforced in the Zustand store (adding a 4th is a no-op with a
  toast/inline message) and re-validated when parsing `searchParams` on `/compare`
  (extra `v` params beyond 3 are ignored, not errored) — the URL is user-editable, so the
  page must be defensive about malformed/oversized input regardless of what the UI
  enforces.
- Minimum of 2 vehicles to render an actual comparison table; 0–1 renders an empty state
  prompting the user to add vehicles (brief's "empty states" requirement).
- Unresolvable slugs in the URL (typo, deleted variant) are skipped with an inline
  notice, not a hard error — a comparison with 2 valid vehicles out of 3 requested
  should still render.

## Evolution path (not built now)

Once accounts exist, "saved comparisons" is additive: a `saved_comparisons` table
(`user_id`, `variant_ids[]` or a join table, `created_at`) that the same `/compare` page
can hydrate from when a `?saved=<id>` param (or a "My Comparisons" list) is present,
without changing how anonymous/URL-based comparison works. The URL-based mechanism
doesn't get replaced — it stays as the no-login path.
