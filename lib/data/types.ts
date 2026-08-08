/**
 * Canonical domain types returned by lib/data/*. Never the raw Supabase row shape —
 * see docs/ARCHITECTURE.md §12: UI components depend on these, never on a database
 * or external-provider response shape directly.
 */

export interface Make {
  id: number;
  slug: string;
  name: string;
  country: string | null;
  logoUrl: string | null;
}

export interface Model {
  id: number;
  slug: string;
  name: string;
  makeId: number;
}

export interface Generation {
  id: number;
  slug: string;
  code: string | null;
  name: string | null;
  productionStartYear: number;
  productionEndYear: number | null;
  modelId: number;
}

export interface Variant {
  id: number;
  slug: string;
  name: string;
  trimLevel: string | null;
  generationId: number;
}

export interface VehicleConfiguration {
  id: number;
  variantId: number;
  modelYear: number;
  specRegionCode: string;
  specRevisionId: number;
  isVerified: boolean;
}

/** The result of the default resolution algorithm — docs/ARCHITECTURE.md §10.5. */
export interface ResolvedConfiguration {
  configuration: VehicleConfiguration;
  /** Always echoes configuration.specRegionCode — kept explicit so callers never
   *  have to remember to read it off a nested object before rendering the
   *  mandatory data-source notice (docs/ARCHITECTURE.md §10.5). */
  specRegionCode: string;
  isVerified: boolean;
}

export interface SpecGeneral {
  bodyTypeSlug: string;
  doors: number | null;
  seats: number | null;
  productionStartDate: string | null;
  productionEndDate: string | null;
}

export interface SpecEngine {
  engineCode: string | null;
  fuelTypeSlug: string;
  displacementCc: number | null;
  cylinders: number | null;
  configuration: string | null;
  aspiration: string | null;
  horsepowerHp: number | null;
  torqueNm: number | null;
}

export interface SpecPerformance {
  accel0To100KmhSec: number | null;
  accel0To60MphSec: number | null;
  topSpeedKmh: number | null;
}

export interface SpecTransmission {
  type: string;
  gearCount: number | null;
  name: string | null;
}

export interface SpecDrivetrain {
  code: string;
}

export interface SpecEconomy {
  fuelConsumptionL100km: number | null;
  fuelTankLiters: number | null;
  batteryCapacityKwh: number | null;
  evRangeKm: number | null;
}

export interface SpecDimensions {
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
  groundClearanceMm: number | null;
}

export interface SpecWeight {
  curbWeightKg: number | null;
  grossWeightKg: number | null;
}

export interface SpecPracticality {
  cargoCapacityLiters: number | null;
  towingCapacityKg: number | null;
}

export interface SpecAttribute {
  key: string;
  category: string;
  dataType: "boolean" | "number" | "text";
  unit: string | null;
  value: boolean | number | string | null;
}

/** Every spec category for one spec_revision, grouped exactly as the Vehicle
 *  page renders them (docs/DATABASE_SCHEMA.md §5.2 category order). */
export interface SpecBundle {
  general: SpecGeneral | null;
  engine: SpecEngine | null;
  performance: SpecPerformance | null;
  transmission: SpecTransmission | null;
  drivetrain: SpecDrivetrain | null;
  economy: SpecEconomy | null;
  dimensions: SpecDimensions | null;
  weight: SpecWeight | null;
  practicality: SpecPracticality | null;
  attributes: SpecAttribute[];
}
