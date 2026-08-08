/**
 * Hand-authored to mirror supabase/migrations/20260808120000_initial_schema.sql
 * exactly (see docs/DATABASE_SCHEMA.md for why each table is shaped this way).
 *
 * This is NOT the output of `supabase gen types typescript` — that command shells
 * out to a `postgres-meta` Docker container to introspect the schema, and Docker
 * image pulls are blocked in this sandbox (see the Phase 1 report). Regenerate this
 * file for real once linked to an actual Supabase project:
 *
 *   npx supabase gen types typescript --linked > types/supabase.ts
 *
 * Until then, keep this file in sync with the migration by hand — Row shapes were
 * verified column-for-column against a live Postgres instance running the actual
 * migration during Phase 1.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      makes: Table<{
        id: number;
        slug: string;
        name: string;
        country: string | null;
        logo_url: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      models: Table<{
        id: number;
        make_id: number;
        slug: string;
        name: string;
        created_at: string;
        updated_at: string;
      }>;
      generations: Table<{
        id: number;
        model_id: number;
        slug: string;
        code: string | null;
        name: string | null;
        production_start_year: number;
        production_end_year: number | null;
        created_at: string;
        updated_at: string;
      }>;
      variants: Table<{
        id: number;
        generation_id: number;
        slug: string;
        name: string;
        trim_level: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      body_types: Table<{
        id: number;
        slug: string;
        name: string;
      }>;
      fuel_types: Table<{
        id: number;
        slug: string;
        name: string;
      }>;
      engines: Table<{
        id: number;
        code: string | null;
        fuel_type_id: number;
        displacement_cc: number | null;
        cylinders: number | null;
        configuration: string | null;
        aspiration: string | null;
        created_at: string;
      }>;
      transmissions: Table<{
        id: number;
        type: string;
        gear_count: number | null;
        name: string | null;
      }>;
      drivetrains: Table<{
        id: number;
        code: string;
        name: string;
      }>;
      spec_regions: Table<{
        id: number;
        code: string;
        name: string;
      }>;
      countries: Table<{
        id: number;
        code: string;
        name: string;
        currency_code: string;
        is_primary: boolean;
        is_active: boolean;
        created_at: string;
      }>;
      data_sources: Table<{
        id: number;
        code: string;
        name: string;
        kind: "global_catalog_api" | "manual_verified" | "editorial" | "armenian_market_feed";
        homepage_url: string | null;
        created_at: string;
      }>;
      spec_revisions: Table<{
        id: number;
        label: string | null;
        is_verified: boolean;
        source: string | null;
        created_at: string;
        updated_at: string;
      }>;
      spec_general: Table<{
        spec_revision_id: number;
        body_type_id: number;
        doors: number | null;
        seats: number | null;
        production_start_date: string | null;
        production_end_date: string | null;
      }>;
      spec_engine: Table<{
        spec_revision_id: number;
        engine_id: number;
        horsepower_hp: number | null;
        torque_nm: number | null;
      }>;
      spec_performance: Table<{
        spec_revision_id: number;
        accel_0_100_kmh_sec: number | null;
        accel_0_60_mph_sec: number | null;
        top_speed_kmh: number | null;
      }>;
      spec_transmission: Table<{
        spec_revision_id: number;
        transmission_id: number;
      }>;
      spec_drivetrain: Table<{
        spec_revision_id: number;
        drivetrain_id: number;
      }>;
      spec_economy: Table<{
        spec_revision_id: number;
        fuel_consumption_l_100km: number | null;
        fuel_tank_liters: number | null;
        battery_capacity_kwh: number | null;
        ev_range_km: number | null;
      }>;
      spec_dimensions: Table<{
        spec_revision_id: number;
        length_mm: number | null;
        width_mm: number | null;
        height_mm: number | null;
        wheelbase_mm: number | null;
        ground_clearance_mm: number | null;
      }>;
      spec_weight: Table<{
        spec_revision_id: number;
        curb_weight_kg: number | null;
        gross_weight_kg: number | null;
      }>;
      spec_practicality: Table<{
        spec_revision_id: number;
        cargo_capacity_liters: number | null;
        towing_capacity_kg: number | null;
      }>;
      spec_attribute_definitions: Table<{
        id: number;
        key: string;
        category: string;
        data_type: "boolean" | "number" | "text";
        unit: string | null;
        created_at: string;
      }>;
      spec_attribute_values: Table<{
        id: number;
        spec_revision_id: number;
        attribute_definition_id: number;
        data_type: "boolean" | "number" | "text";
        value_boolean: boolean | null;
        value_number: number | null;
        value_text: string | null;
        created_at: string;
      }>;
      vehicle_configurations: Table<{
        id: number;
        variant_id: number;
        model_year: number;
        spec_region_id: number;
        spec_revision_id: number;
        is_verified: boolean;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_images: Table<{
        id: number;
        variant_id: number;
        vehicle_configuration_id: number | null;
        provider: "seed_local" | "external_api" | "supabase_storage";
        external_ref: string | null;
        url: string;
        position: number;
        is_primary: boolean;
        created_at: string;
      }>;
      external_source_mappings: Table<{
        id: number;
        data_source_id: number;
        entity_type:
          | "make"
          | "model"
          | "generation"
          | "variant"
          | "vehicle_configuration"
          | "engine"
          | "spec_revision";
        entity_id: number;
        external_id: string;
        external_url: string | null;
        fetched_at: string | null;
        raw_payload: Json | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
