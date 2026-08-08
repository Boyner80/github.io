-- Lav Auto — development seed data.
--
-- THIS IS NOT REAL AUTOMOTIVE DATA. Every number below is a plausible-looking
-- placeholder, hand-entered to exercise the schema (docs/DATABASE_SCHEMA.md) and the
-- identity model (docs/ARCHITECTURE.md §10), NOT verified against any manufacturer
-- source. Every spec_revisions row is inserted with is_verified = false and a
-- data_sources row of kind 'editorial' that says so explicitly — the repository layer
-- and UI must surface that, never present this as factual production data. See
-- docs/IMPLEMENTATION_PLAN.md Phase 1.
--
-- Deliberately does NOT include an 'AM' spec_region row for any configuration: an
-- unverified "Armenia-representative" row in shared dev seed would be exactly the kind
-- of mislabeling docs/ARCHITECTURE.md §10.5 exists to prevent, even in a dev database.

-- ============================================================================
-- Provenance
-- ============================================================================

insert into data_sources (code, name, kind, homepage_url) values
  ('dev_seed_fixture', 'Lav Auto development seed fixture (not verified)', 'editorial', null);

-- ============================================================================
-- Lookups
-- ============================================================================

insert into spec_regions (code, name) values
  ('GLOBAL', 'Global / unspecified'),
  ('US', 'United States'),
  ('EU', 'European Union');

insert into countries (code, name, currency_code, is_primary, is_active) values
  ('AM', 'Armenia', 'AMD', true, true);

insert into body_types (slug, name) values
  ('sedan', 'Sedan'),
  ('suv', 'SUV');

insert into fuel_types (slug, name) values
  ('petrol', 'Petrol');

insert into drivetrains (code, name) values
  ('AWD', 'All-Wheel Drive'),
  ('FWD', 'Front-Wheel Drive');

insert into transmissions (type, gear_count, name) values
  ('automatic_torque_converter', 8, '8-Speed Automatic (ZF 8HP)'),
  ('cvt', null, 'Continuously Variable Transmission');

-- Shared engine hardware: the same B58-family block, reused across two variants
-- with different tuned output — demonstrates why horsepower/torque live on
-- spec_engine, not on the engines table (docs/DATABASE_SCHEMA.md §6).
insert into engines (code, fuel_type_id, displacement_cc, cylinders, configuration, aspiration) values
  ('B58-3.0T', (select id from fuel_types where slug = 'petrol'), 2998, 6, 'inline', 'turbo'),
  ('A25A-FKS-2.0', (select id from fuel_types where slug = 'petrol'), 1987, 4, 'inline', 'natural');

-- ============================================================================
-- Hierarchy
-- ============================================================================

insert into makes (slug, name, country) values
  ('bmw', 'BMW', 'DE'),
  ('toyota', 'Toyota', 'JP');

insert into models (make_id, slug, name) values
  ((select id from makes where slug = 'bmw'), '3-series', '3 Series'),
  ((select id from makes where slug = 'bmw'), 'x5', 'X5'),
  ((select id from makes where slug = 'toyota'), 'corolla', 'Corolla');

insert into generations (model_id, slug, code, name, production_start_year, production_end_year) values
  ((select id from models where slug = '3-series'), 'g20', 'G20', null, 2019, null),
  ((select id from models where slug = 'x5'), 'g05', 'G05', null, 2018, null),
  ((select id from models where slug = 'corolla'), 'e210', 'E210', null, 2019, null);

insert into variants (generation_id, slug, name, trim_level) values
  ((select id from generations where slug = 'g20'), 'm340i-xdrive', 'M340i xDrive', 'M Performance'),
  ((select id from generations where slug = 'g05'), 'xdrive40i', 'xDrive40i', null),
  ((select id from generations where slug = 'e210'), 'se', 'SE', null);

-- ============================================================================
-- Spec revisions (reusable spec content — see docs/DATABASE_SCHEMA.md §5.1)
-- ============================================================================

insert into spec_revisions (label, is_verified, source) values
  ('G20 M340i xDrive, US-spec, pre-facelift (dev fixture)', false, 'seed/dev-fixture — not verified'),
  ('G20 M340i xDrive, US-spec, facelift (dev fixture)', false, 'seed/dev-fixture — not verified'),
  ('G20 M340i xDrive, EU-spec, facelift (dev fixture)', false, 'seed/dev-fixture — not verified'),
  ('G05 xDrive40i, US-spec (dev fixture)', false, 'seed/dev-fixture — not verified'),
  ('E210 Corolla SE, unspecified region (dev fixture)', false, 'seed/dev-fixture — not verified');

-- Handy view of the five revisions in insertion order, for the category inserts below.
-- rev 1 = M340i pre-facelift US, rev 2 = M340i facelift US, rev 3 = M340i facelift EU,
-- rev 4 = X5 xDrive40i US, rev 5 = Corolla SE GLOBAL.

insert into spec_general (spec_revision_id, body_type_id, doors, seats, production_start_date, production_end_date)
select r.id, (select id from body_types where slug = 'sedan'), 4, 5, d.start_date, d.end_date
from spec_revisions r
join (values
  ('G20 M340i xDrive, US-spec, pre-facelift (dev fixture)', date '2019-03-01', date '2022-06-30'),
  ('G20 M340i xDrive, US-spec, facelift (dev fixture)',     date '2022-07-01', null),
  ('G20 M340i xDrive, EU-spec, facelift (dev fixture)',     date '2022-07-01', null)
) as d(label, start_date, end_date) on d.label = r.label;

insert into spec_general (spec_revision_id, body_type_id, doors, seats, production_start_date, production_end_date)
values
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'),
   (select id from body_types where slug = 'suv'), 5, 5, date '2023-06-01', null),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'),
   (select id from body_types where slug = 'sedan'), 4, 5, date '2019-08-01', null);

insert into spec_engine (spec_revision_id, engine_id, horsepower_hp, torque_nm) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'),
   (select id from engines where code = 'B58-3.0T'), 382, 500),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'),
   (select id from engines where code = 'B58-3.0T'), 386, 500),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'),
   (select id from engines where code = 'B58-3.0T'), 374, 500),
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'),
   (select id from engines where code = 'B58-3.0T'), 375, 398),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'),
   (select id from engines where code = 'A25A-FKS-2.0'), 169, 200);

insert into spec_performance (spec_revision_id, accel_0_100_kmh_sec, accel_0_60_mph_sec, top_speed_kmh) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), 4.4, 4.2, 250),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), 4.3, 4.1, 250),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'), 4.4, 4.2, 250),
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'), 5.5, 5.3, 230),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'), 8.9, 8.6, 200);

insert into spec_transmission (spec_revision_id, transmission_id)
select r.id, (select id from transmissions where name = '8-Speed Automatic (ZF 8HP)')
from spec_revisions r
where r.label in (
  'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)',
  'G20 M340i xDrive, US-spec, facelift (dev fixture)',
  'G20 M340i xDrive, EU-spec, facelift (dev fixture)',
  'G05 xDrive40i, US-spec (dev fixture)'
);

insert into spec_transmission (spec_revision_id, transmission_id) values
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'),
   (select id from transmissions where name = 'Continuously Variable Transmission'));

insert into spec_drivetrain (spec_revision_id, drivetrain_id)
select r.id, (select id from drivetrains where code = 'AWD')
from spec_revisions r
where r.label in (
  'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)',
  'G20 M340i xDrive, US-spec, facelift (dev fixture)',
  'G20 M340i xDrive, EU-spec, facelift (dev fixture)',
  'G05 xDrive40i, US-spec (dev fixture)'
);

insert into spec_drivetrain (spec_revision_id, drivetrain_id) values
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'),
   (select id from drivetrains where code = 'FWD'));

insert into spec_economy (spec_revision_id, fuel_consumption_l_100km, fuel_tank_liters, battery_capacity_kwh, ev_range_km) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), 9.7, 59, null, null),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), 9.5, 59, null, null),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'), 8.9, 59, null, null),
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'), 11.2, 80, null, null),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'), 6.0, 47, null, null);

insert into spec_dimensions (spec_revision_id, length_mm, width_mm, height_mm, wheelbase_mm, ground_clearance_mm) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), 4709, 1827, 1442, 2851, 130),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), 4713, 1827, 1442, 2851, 130),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'), 4713, 1827, 1442, 2851, 130),
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'), 4922, 2004, 1755, 2975, 214),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'), 4630, 1780, 1435, 2700, 140);

insert into spec_weight (spec_revision_id, curb_weight_kg, gross_weight_kg) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), 1735, 2160),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), 1740, 2165),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'), 1755, 2180),
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'), 2135, 2720),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'), 1330, 1780);

insert into spec_practicality (spec_revision_id, cargo_capacity_liters, towing_capacity_kg) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), 480, null),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), 480, null),
  ((select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'), 480, null),
  ((select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'), 650, 2700),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'), 371, null);

-- One long-tail attribute, to exercise spec_attribute_definitions/values
-- (docs/DATABASE_SCHEMA.md §5.4) without it being one of the nine core categories.
insert into spec_attribute_definitions (key, category, data_type, unit) values
  ('heated_steering_wheel', 'comfort', 'boolean', null);

insert into spec_attribute_values (spec_revision_id, attribute_definition_id, data_type, value_boolean) values
  ((select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'),
   (select id from spec_attribute_definitions where key = 'heated_steering_wheel'), 'boolean', true),
  ((select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'),
   (select id from spec_attribute_definitions where key = 'heated_steering_wheel'), 'boolean', false);

-- ============================================================================
-- Vehicle configurations — exercises dedup (2022/2023 share a revision), a
-- facelift (2024 US points at a new revision), and spec-region differentiation
-- (2024 US vs 2024 EU) — see docs/ARCHITECTURE.md §10.3.
-- ============================================================================

insert into vehicle_configurations (variant_id, model_year, spec_region_id, spec_revision_id, is_verified) values
  ((select id from variants where slug = 'm340i-xdrive'), 2022,
   (select id from spec_regions where code = 'US'),
   (select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), false),
  ((select id from variants where slug = 'm340i-xdrive'), 2023,
   (select id from spec_regions where code = 'US'),
   (select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, pre-facelift (dev fixture)'), false),
  ((select id from variants where slug = 'm340i-xdrive'), 2024,
   (select id from spec_regions where code = 'US'),
   (select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), false),
  ((select id from variants where slug = 'm340i-xdrive'), 2024,
   (select id from spec_regions where code = 'EU'),
   (select id from spec_revisions where label = 'G20 M340i xDrive, EU-spec, facelift (dev fixture)'), false),
  ((select id from variants where slug = 'm340i-xdrive'), 2025,
   (select id from spec_regions where code = 'US'),
   (select id from spec_revisions where label = 'G20 M340i xDrive, US-spec, facelift (dev fixture)'), false),
  ((select id from variants where slug = 'xdrive40i'), 2024,
   (select id from spec_regions where code = 'US'),
   (select id from spec_revisions where label = 'G05 xDrive40i, US-spec (dev fixture)'), false),
  ((select id from variants where slug = 'se'), 2024,
   (select id from spec_regions where code = 'GLOBAL'),
   (select id from spec_revisions where label = 'E210 Corolla SE, unspecified region (dev fixture)'), false);

-- ============================================================================
-- Provenance mappings — every seeded configuration is traceable to the dev
-- fixture data source, demonstrating the mechanism from docs/ARCHITECTURE.md §12
-- even though no real external provider is involved yet.
-- ============================================================================

insert into external_source_mappings (data_source_id, entity_type, entity_id, external_id, fetched_at)
select
  (select id from data_sources where code = 'dev_seed_fixture'),
  'vehicle_configuration',
  vc.id,
  'dev-fixture:' || vc.id,
  now()
from vehicle_configurations vc;
