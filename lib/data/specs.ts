import { createClient } from "@/lib/supabase/server";
import type { SpecAttribute, SpecBundle } from "@/lib/data/types";

/**
 * Row shapes for the embedded-resource selects below are declared explicitly and
 * cast at the query boundary, rather than relying on supabase-js's compile-time
 * select-string parser to infer them from `types/supabase.ts`. That parser infers
 * embedded-relation shapes from each table's `Relationships` metadata, which the
 * real `supabase gen types` output populates from actual foreign keys — our
 * hand-authored types/supabase.ts (see the note at its top) leaves `Relationships`
 * empty, so the parser can't resolve these joins on its own. The joins themselves
 * were verified directly against the live schema during Phase 1 (see the Phase 1
 * report); this is a typing-only workaround, not an unverified assumption about
 * the data shape. Regenerate types/supabase.ts for real once linked to a Supabase
 * project and this cast layer can be removed.
 */

interface GeneralRow {
  doors: number | null;
  seats: number | null;
  production_start_date: string | null;
  production_end_date: string | null;
  body_types: { slug: string } | null;
}

interface EngineRow {
  horsepower_hp: number | null;
  torque_nm: number | null;
  engines: {
    code: string | null;
    displacement_cc: number | null;
    cylinders: number | null;
    configuration: string | null;
    aspiration: string | null;
    fuel_types: { slug: string } | null;
  } | null;
}

interface PerformanceRow {
  accel_0_100_kmh_sec: number | null;
  accel_0_60_mph_sec: number | null;
  top_speed_kmh: number | null;
}

interface TransmissionRow {
  transmissions: { type: string; gear_count: number | null; name: string | null } | null;
}

interface DrivetrainRow {
  drivetrains: { code: string } | null;
}

interface EconomyRow {
  fuel_consumption_l_100km: number | null;
  fuel_tank_liters: number | null;
  battery_capacity_kwh: number | null;
  ev_range_km: number | null;
}

interface DimensionsRow {
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  ground_clearance_mm: number | null;
}

interface WeightRow {
  curb_weight_kg: number | null;
  gross_weight_kg: number | null;
}

interface PracticalityRow {
  cargo_capacity_liters: number | null;
  towing_capacity_kg: number | null;
}

interface AttributeValueRow {
  data_type: "boolean" | "number" | "text";
  value_boolean: boolean | null;
  value_number: number | null;
  value_text: string | null;
  spec_attribute_definitions: { key: string; category: string; unit: string | null } | null;
}

/**
 * Fetches every spec category for one spec_revision and groups them exactly as
 * the Vehicle page renders them (docs/DATABASE_SCHEMA.md §5.2). Called with the
 * `specRevisionId` from a resolved configuration (lib/data/configurations.ts),
 * never with a bare variant/configuration id — spec content is keyed to the
 * revision, not the configuration, so this is the one correct entry point.
 */
export async function getSpecsForRevision(specRevisionId: number): Promise<SpecBundle> {
  const supabase = await createClient();

  const [general, engine, performance, transmission, drivetrain, economy, dimensions, weight, practicality, attributes] =
    await Promise.all([
      supabase
        .from("spec_general")
        .select("doors, seats, production_start_date, production_end_date, body_types(slug)")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_engine")
        .select(
          "horsepower_hp, torque_nm, engines(code, displacement_cc, cylinders, configuration, aspiration, fuel_types(slug))",
        )
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_performance")
        .select("accel_0_100_kmh_sec, accel_0_60_mph_sec, top_speed_kmh")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_transmission")
        .select("transmissions(type, gear_count, name)")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_drivetrain")
        .select("drivetrains(code)")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_economy")
        .select("fuel_consumption_l_100km, fuel_tank_liters, battery_capacity_kwh, ev_range_km")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_dimensions")
        .select("length_mm, width_mm, height_mm, wheelbase_mm, ground_clearance_mm")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_weight")
        .select("curb_weight_kg, gross_weight_kg")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_practicality")
        .select("cargo_capacity_liters, towing_capacity_kg")
        .eq("spec_revision_id", specRevisionId)
        .maybeSingle(),
      supabase
        .from("spec_attribute_values")
        .select(
          "data_type, value_boolean, value_number, value_text, spec_attribute_definitions(key, category, unit)",
        )
        .eq("spec_revision_id", specRevisionId),
    ]);

  for (const result of [general, engine, performance, transmission, drivetrain, economy, dimensions, weight, practicality, attributes]) {
    if (result.error) throw result.error;
  }

  const generalRow = general.data as unknown as GeneralRow | null;
  const engineRow = engine.data as unknown as EngineRow | null;
  const performanceRow = performance.data as unknown as PerformanceRow | null;
  const transmissionRow = transmission.data as unknown as TransmissionRow | null;
  const drivetrainRow = drivetrain.data as unknown as DrivetrainRow | null;
  const economyRow = economy.data as unknown as EconomyRow | null;
  const dimensionsRow = dimensions.data as unknown as DimensionsRow | null;
  const weightRow = weight.data as unknown as WeightRow | null;
  const practicalityRow = practicality.data as unknown as PracticalityRow | null;
  const attributeRows = (attributes.data ?? []) as unknown as AttributeValueRow[];

  return {
    general: generalRow
      ? {
          bodyTypeSlug: generalRow.body_types?.slug ?? "",
          doors: generalRow.doors,
          seats: generalRow.seats,
          productionStartDate: generalRow.production_start_date,
          productionEndDate: generalRow.production_end_date,
        }
      : null,
    engine: engineRow
      ? {
          engineCode: engineRow.engines?.code ?? null,
          fuelTypeSlug: engineRow.engines?.fuel_types?.slug ?? "",
          displacementCc: engineRow.engines?.displacement_cc ?? null,
          cylinders: engineRow.engines?.cylinders ?? null,
          configuration: engineRow.engines?.configuration ?? null,
          aspiration: engineRow.engines?.aspiration ?? null,
          horsepowerHp: engineRow.horsepower_hp,
          torqueNm: engineRow.torque_nm,
        }
      : null,
    performance: performanceRow
      ? {
          accel0To100KmhSec: performanceRow.accel_0_100_kmh_sec,
          accel0To60MphSec: performanceRow.accel_0_60_mph_sec,
          topSpeedKmh: performanceRow.top_speed_kmh,
        }
      : null,
    transmission: transmissionRow?.transmissions
      ? {
          type: transmissionRow.transmissions.type,
          gearCount: transmissionRow.transmissions.gear_count,
          name: transmissionRow.transmissions.name,
        }
      : null,
    drivetrain: drivetrainRow?.drivetrains ? { code: drivetrainRow.drivetrains.code } : null,
    economy: economyRow
      ? {
          fuelConsumptionL100km: economyRow.fuel_consumption_l_100km,
          fuelTankLiters: economyRow.fuel_tank_liters,
          batteryCapacityKwh: economyRow.battery_capacity_kwh,
          evRangeKm: economyRow.ev_range_km,
        }
      : null,
    dimensions: dimensionsRow
      ? {
          lengthMm: dimensionsRow.length_mm,
          widthMm: dimensionsRow.width_mm,
          heightMm: dimensionsRow.height_mm,
          wheelbaseMm: dimensionsRow.wheelbase_mm,
          groundClearanceMm: dimensionsRow.ground_clearance_mm,
        }
      : null,
    weight: weightRow
      ? { curbWeightKg: weightRow.curb_weight_kg, grossWeightKg: weightRow.gross_weight_kg }
      : null,
    practicality: practicalityRow
      ? {
          cargoCapacityLiters: practicalityRow.cargo_capacity_liters,
          towingCapacityKg: practicalityRow.towing_capacity_kg,
        }
      : null,
    attributes: attributeRows.map(
      (row): SpecAttribute => ({
        key: row.spec_attribute_definitions?.key ?? "",
        category: row.spec_attribute_definitions?.category ?? "",
        dataType: row.data_type,
        unit: row.spec_attribute_definitions?.unit ?? null,
        value: row.value_boolean ?? row.value_number ?? row.value_text ?? null,
      }),
    ),
  };
}
