# Lav Auto — Localization Strategy

## Languages (V1)

- English (`en`) — default
- Armenian (`hy`)
- Russian (`ru`)

## Library & routing

- **`next-intl`**, App Router-native, works with server components and static
  rendering, supports ICU message syntax (needed for correct pluralization in Russian
  and Armenian, which don't follow English plural rules).
- Locale is a URL prefix: `/en/...`, `/hy/...`, `/ru/...`. Decided explicitly over
  cookie-based or domain-based locale switching because URL-encoded locale is:
  - crawlable/indexable per-language (SEO requirement in the brief),
  - shareable (a link carries its language),
  - and because changing this scheme later would break every previously-indexed URL
    (flagged as an expensive-to-change decision in `ARCHITECTURE.md` §9.4).
- `middleware.ts` handles locale detection (Accept-Language header) and redirect to a
  prefixed URL; the negotiated/selected locale is then persisted in a cookie so a
  returning visitor isn't re-negotiated every visit.

## Two separate axes: language vs. units

Language locale (`en`/`hy`/`ru`) and unit system (`metric`/`imperial`) are **independent
preferences**, not derived from each other. An Armenian speaker may want mph; a US
English speaker may want km/h. Unit system is stored client-side (cookie/localStorage),
defaults to metric, and is applied purely at render time via `lib/units/*` — it never
affects routing or the database.

## What is translated vs. what is not

**Never translated** (rendered as-is in every locale, straight from the database):

- Make names (`BMW`)
- Model names (`3 Series`)
- Generation codes/names (`G20`)
- Variant/trim names (`M340i`, `xDrive`)
- Engine codes (`B58`)

These are proper nouns/technical identifiers, exactly as called out in the brief.

**Always translated**, via translation keys in `messages/{locale}.json`:

- All UI chrome: navigation, buttons, form labels, empty/loading/error states, page
  section headings ("Specifications", "Add to Comparison", "Popular Manufacturers"...).
- Spec **category** labels ("Engine", "Performance", "Dimensions", ...).
- Spec **field** labels ("Horsepower", "Torque", "0–100 km/h", ...).
- Enumerable spec **values** — body type, fuel type, drivetrain, transmission type,
  aspiration. These come from lookup tables in the database (see
  `DATABASE_SCHEMA.md` §4) that store a stable `slug`/`code`, e.g. `body_types.slug =
  'sedan'`. The UI looks up the translated label by key:
  `t('specs.bodyType.' + bodyType.slug)`. The database is never the source of the
  *displayed* label for these — only of the stable key used to find it.
- Generated vehicle summaries (see `ARCHITECTURE.md` §2 risk #5): an ICU message
  template per locale, interpolated with untranslated identity fields and translated
  enum labels, e.g.:

  ```json
  // messages/en.json
  "vehicle.summary": "{make} {model} {variant} — {horsepower} hp, {drivetrain}"
  ```

## Message file organization

Namespaced JSON, one file per locale, mirrored key structure across all three so missing
keys are easy to spot in review:

```
messages/en.json
{
  "common": { "loading": "Loading...", "error": "Something went wrong" },
  "nav": { "home": "Home", "compare": "Compare" },
  "home": { "searchPlaceholder": "Search make, model, or trim", "popularMakes": "Popular Manufacturers" },
  "vehicle": { "addToCompare": "Add to Comparison", "summary": "{make} {model} {variant}..." },
  "specs": {
    "category": { "general": "General", "engine": "Engine", "performance": "Performance", ... },
    "field": { "horsepower": "Horsepower", "torque": "Torque", "topSpeed": "Top Speed", ... },
    "bodyType": { "sedan": "Sedan", "suv": "SUV", "coupe": "Coupe", ... },
    "fuelType": { "petrol": "Petrol", "diesel": "Diesel", "electric": "Electric", ... },
    "drivetrain": { "fwd": "Front-Wheel Drive", "rwd": "Rear-Wheel Drive", "awd": "All-Wheel Drive", "4wd": "Four-Wheel Drive" }
  },
  "compare": { "title": "Compare Vehicles", "addAnother": "Add Another Vehicle", "remove": "Remove" }
}
```

`hy.json` and `ru.json` mirror this key structure with translated values. A CI check
(later phase, not V1-blocking) can assert all three files have identical key sets so a
missing translation fails the build instead of silently falling back to English in
production.

## Enforcement rule

No `.tsx` file may contain a hard-coded, user-facing string literal. Every user-facing
string is retrieved via `useTranslations()` (client) or `getTranslations()`
(server component). This is a hard rule from the brief ("Never hard-code user-facing
interface strings"), not a style preference — reviewed on every PR.

## Numbers & formatting

- Grouping separators, decimal points, etc. use `Intl.NumberFormat(locale, ...)` — do
  not hand-roll number formatting.
- Unit conversion functions (`lib/units/*`) are pure, take a canonical DB value and
  return a converted+rounded display value; they are locale-agnostic. Formatting the
  converted number for display goes through `Intl.NumberFormat` separately, keeping
  "convert the unit" and "format the number" as two composable, independently testable
  concerns.

## Adding a fourth language later

1. Add `messages/{locale}.json` (translate every key from `en.json`).
2. Add the locale code to `lib/i18n/routing.ts`'s locale list.
3. No component, route, or database change is required — this is the concrete payoff of
   never hard-coding strings and never routing based on anything but the locale prefix.
