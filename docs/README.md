# Lav Auto — Project Documentation

This folder contains the architecture and planning documentation produced before any
application code is written, per the initial project brief.

Read in this order:

1. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system architecture, key risks/ambiguities,
   technology decisions, how the system evolves toward the long-term platform, and which
   decisions are expensive to change later.
2. [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) — the normalized automotive data model
   (Make → Model → Generation → Variant → Specifications) with DDL and an ERD.
3. [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) — proposed Next.js project layout.
4. [`LOCALIZATION.md`](./LOCALIZATION.md) — i18n strategy for English, Armenian, Russian.
5. [`COMPARISON_STATE.md`](./COMPARISON_STATE.md) — how the 2–3 vehicle comparison feature
   holds and shares state without user accounts.
6. [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — phased V1 build plan.

**Status:** planning only. No application code has been scaffolded yet. This documentation
is meant to be reviewed and approved before Phase 0 of the implementation plan begins.

**Scope reminder:** V1 is automotive data, discovery, search, specification pages,
comparison, and internationalization only. No accounts, garages, social features, or
business listings are implemented yet — see "Future Platform Evolution" in
`ARCHITECTURE.md` for how the schema and app leave room for them without a rewrite.
