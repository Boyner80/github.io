-- Lav Auto — initial V1 schema.
-- Mirrors docs/DATABASE_SCHEMA.md exactly; that document is the source of truth for
-- *why* each table/column is shaped this way. Keep the two in sync.

create extension if not exists pg_trgm;

-- ============================================================================
-- Hierarchy: makes -> models -> generations -> variants
-- ============================================================================

create table makes (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  name          text not null,
  country       text,
  logo_url      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table models (
  id            bigint generated always as identity primary key,
  make_id       bigint not null references makes(id) on delete restrict,
  slug          text not null,
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (make_id, slug)
);

create table generations (
  id                    bigint generated always as identity primary key,
  model_id              bigint not null references models(id) on delete restrict,
  slug                  text not null,
  code                  text,
  name                  text,
  production_start_year smallint not null,
  production_end_year   smallint,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (model_id, slug),
  check (production_end_year is null or production_end_year >= production_start_year)
);

create table variants (
  id               bigint generated always as identity primary key,
  generation_id    bigint not null references generations(id) on delete restrict,
  slug             text not null,
  name             text not null,
  trim_level       text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (generation_id, slug)
);

-- ============================================================================
-- Lookup tables
-- ============================================================================

create table body_types (
  id    bigint generated always as identity primary key,
  slug  text not null unique,
  name  text not null
);

create table fuel_types (
  id    bigint generated always as identity primary key,
  slug  text not null unique,
  name  text not null
);

create table engines (
  id              bigint generated always as identity primary key,
  code            text,
  fuel_type_id    bigint not null references fuel_types(id),
  displacement_cc integer,
  cylinders       smallint,
  configuration   text,
  aspiration      text,
  created_at      timestamptz not null default now(),
  unique (code)
);

create table transmissions (
  id          bigint generated always as identity primary key,
  type        text not null,
  gear_count  smallint,
  name        text,
  unique (type, gear_count, name)
);

create table drivetrains (
  id    bigint generated always as identity primary key,
  code  text not null unique,
  name  text not null
);

-- Regulatory/homologation region a vehicle_configuration's numbers reflect
-- (US-spec, EU-spec, ...). NOT a commercial market — see countries below and
-- docs/ARCHITECTURE.md §10.5 / §11.2 for why these are deliberately separate tables.
create table spec_regions (
  id    bigint generated always as identity primary key,
  code  text not null unique,
  name  text not null
);

-- Commercial/business geography (Armenia-first) — where Lav Auto operates, not
-- which regulatory spec a car was built to. See docs/ARCHITECTURE.md §11.
create table countries (
  id             bigint generated always as identity primary key,
  code           text not null unique,
  name           text not null,
  currency_code  text not null,
  is_primary     boolean not null default false,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Provenance: where an imported catalog record came from. See
-- docs/ARCHITECTURE.md §12 and docs/DATABASE_SCHEMA.md §8.
create table data_sources (
  id            bigint generated always as identity primary key,
  code          text not null unique,
  name          text not null,
  kind          text not null check (kind in (
    'global_catalog_api',
    'manual_verified',
    'editorial',
    'armenian_market_feed'
  )),
  homepage_url  text,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- Specifications: spec_revisions (reusable content) + one table per category
-- ============================================================================

create table spec_revisions (
  id              bigint generated always as identity primary key,
  label           text,
  is_verified     boolean not null default false,
  source          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table spec_general (
  spec_revision_id      bigint primary key references spec_revisions(id) on delete cascade,
  body_type_id           bigint not null references body_types(id),
  doors                  smallint,
  seats                  smallint,
  production_start_date  date,
  production_end_date    date
);

create table spec_engine (
  spec_revision_id  bigint primary key references spec_revisions(id) on delete cascade,
  engine_id         bigint not null references engines(id),
  horsepower_hp     integer,
  torque_nm         integer
);

create table spec_performance (
  spec_revision_id     bigint primary key references spec_revisions(id) on delete cascade,
  accel_0_100_kmh_sec  numeric(4,2),
  accel_0_60_mph_sec   numeric(4,2),
  top_speed_kmh        integer
);

create table spec_transmission (
  spec_revision_id  bigint primary key references spec_revisions(id) on delete cascade,
  transmission_id   bigint not null references transmissions(id)
);

create table spec_drivetrain (
  spec_revision_id  bigint primary key references spec_revisions(id) on delete cascade,
  drivetrain_id     bigint not null references drivetrains(id)
);

create table spec_economy (
  spec_revision_id           bigint primary key references spec_revisions(id) on delete cascade,
  fuel_consumption_l_100km   numeric(4,1),
  fuel_tank_liters           integer,
  battery_capacity_kwh       numeric(5,1),
  ev_range_km                integer
);

create table spec_dimensions (
  spec_revision_id   bigint primary key references spec_revisions(id) on delete cascade,
  length_mm           integer,
  width_mm             integer,
  height_mm            integer,
  wheelbase_mm         integer,
  ground_clearance_mm  integer
);

create table spec_weight (
  spec_revision_id  bigint primary key references spec_revisions(id) on delete cascade,
  curb_weight_kg     integer,
  gross_weight_kg    integer
);

create table spec_practicality (
  spec_revision_id     bigint primary key references spec_revisions(id) on delete cascade,
  cargo_capacity_liters integer,
  towing_capacity_kg    integer
);

-- Long-tail specification extension — see docs/DATABASE_SCHEMA.md §5.3-5.4.
create table spec_attribute_definitions (
  id          bigint generated always as identity primary key,
  key         text not null unique,
  category    text not null,
  data_type   text not null check (data_type in ('boolean', 'number', 'text')),
  unit        text,
  created_at  timestamptz not null default now()
);

create table spec_attribute_values (
  id                       bigint generated always as identity primary key,
  spec_revision_id         bigint not null references spec_revisions(id) on delete cascade,
  attribute_definition_id  bigint not null references spec_attribute_definitions(id) on delete restrict,
  data_type                text not null check (data_type in ('boolean', 'number', 'text')),
  value_boolean            boolean,
  value_number             numeric,
  value_text               text,
  created_at               timestamptz not null default now(),
  unique (spec_revision_id, attribute_definition_id),
  check (
    (data_type = 'boolean' and value_boolean is not null and value_number is null and value_text is null) or
    (data_type = 'number' and value_number is not null and value_boolean is null and value_text is null) or
    (data_type = 'text' and value_text is not null and value_boolean is null and value_number is null)
  )
);

-- ============================================================================
-- Vehicle configurations: the stable per-year, per-spec-region identity
-- ============================================================================

create table vehicle_configurations (
  id                bigint generated always as identity primary key,
  variant_id        bigint not null references variants(id) on delete restrict,
  model_year        smallint not null,
  spec_region_id    bigint not null references spec_regions(id),
  spec_revision_id  bigint not null references spec_revisions(id) on delete restrict,
  is_verified        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (variant_id, model_year, spec_region_id)
);

-- ============================================================================
-- Images
-- ============================================================================

create table vehicle_images (
  id                        bigint generated always as identity primary key,
  variant_id                bigint not null references variants(id) on delete cascade,
  vehicle_configuration_id  bigint references vehicle_configurations(id) on delete set null,
  provider                  text not null check (provider in ('seed_local', 'external_api', 'supabase_storage')),
  external_ref              text,
  url                       text not null,
  position                   smallint not null default 0,
  is_primary                 boolean not null default false,
  created_at                 timestamptz not null default now()
);

-- ============================================================================
-- External source provenance — see docs/ARCHITECTURE.md §12, docs/DATABASE_SCHEMA.md §8
-- ============================================================================

create table external_source_mappings (
  id              bigint generated always as identity primary key,
  data_source_id  bigint not null references data_sources(id) on delete restrict,
  entity_type     text not null check (entity_type in (
    'make', 'model', 'generation', 'variant', 'vehicle_configuration', 'engine', 'spec_revision'
  )),
  entity_id       bigint not null,
  external_id     text not null,
  external_url    text,
  fetched_at      timestamptz,
  raw_payload     jsonb,
  created_at      timestamptz not null default now(),
  unique (data_source_id, entity_type, external_id),
  unique (data_source_id, entity_type, entity_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index on models (make_id);
create index on generations (model_id);
create index on variants (generation_id);
create index on vehicle_configurations (variant_id);
create index on vehicle_configurations (spec_revision_id);
create index on vehicle_images (variant_id, position);
create index on vehicle_images (vehicle_configuration_id);
create index on external_source_mappings (entity_type, entity_id);

create index makes_name_trgm_idx on makes using gin (name gin_trgm_ops);
create index models_name_trgm_idx on models using gin (name gin_trgm_ops);
create index variants_name_trgm_idx on variants using gin (name gin_trgm_ops);

-- ============================================================================
-- Row Level Security — every catalog table is public-read, no anon/authenticated
-- write path. All writes happen via migrations/seed/ingestion scripts using the
-- service role, which bypasses RLS. See docs/DATABASE_SCHEMA.md §10.
-- ============================================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'makes', 'models', 'generations', 'variants',
      'body_types', 'fuel_types', 'engines', 'transmissions', 'drivetrains',
      'spec_regions', 'countries', 'data_sources',
      'spec_revisions', 'spec_general', 'spec_engine', 'spec_performance',
      'spec_transmission', 'spec_drivetrain', 'spec_economy', 'spec_dimensions',
      'spec_weight', 'spec_practicality',
      'spec_attribute_definitions', 'spec_attribute_values',
      'vehicle_configurations', 'vehicle_images',
      'external_source_mappings'
    ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "public read" on %I for select to anon, authenticated using (true)',
      t
    );
    -- Supabase's Data API roles need an explicit table-level GRANT in addition to
    -- the RLS policy above (new projects no longer auto-expose new tables to the
    -- API roles) — see docs/DATABASE_SCHEMA.md §10 revision context.
    execute format('grant select on %I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
