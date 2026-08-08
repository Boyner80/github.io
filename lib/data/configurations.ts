import { createClient } from "@/lib/supabase/server";
import type { ResolvedConfiguration, VehicleConfiguration } from "@/lib/data/types";

const GLOBAL_SPEC_REGION = "GLOBAL";

type ConfigurationRow = {
  id: number;
  variant_id: number;
  model_year: number;
  spec_revision_id: number;
  is_verified: boolean;
  spec_regions: { code: string } | { code: string }[] | null;
};

function toConfiguration(row: ConfigurationRow): VehicleConfiguration {
  const specRegion = Array.isArray(row.spec_regions) ? row.spec_regions[0] : row.spec_regions;
  if (!specRegion) {
    throw new Error(`vehicle_configuration ${row.id} is missing its spec_regions join`);
  }
  return {
    id: row.id,
    variantId: row.variant_id,
    modelYear: row.model_year,
    specRegionCode: specRegion.code,
    specRevisionId: row.spec_revision_id,
    isVerified: row.is_verified,
  };
}

export async function listConfigurationsForVariant(
  variantId: number,
): Promise<VehicleConfiguration[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_configurations")
    .select("id, variant_id, model_year, spec_revision_id, is_verified, spec_regions(code)")
    .eq("variant_id", variantId)
    .order("model_year", { ascending: false });

  if (error) throw error;
  return data.map(toConfiguration);
}

/**
 * Lav Auto's primary commercial market — a constant for V1 (no market-switching
 * UI exists), but read from `countries` rather than hardcoded, so the schema
 * stays the single source of truth. See docs/ARCHITECTURE.md §10.5 and §11.3.
 */
export async function getPrimaryMarketCode(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("countries")
    .select("code")
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  // Defensive fallback only — a primary country row should always exist in a
  // correctly seeded database (docs/DATABASE_SCHEMA.md §6.1).
  return data?.code ?? "AM";
}

/**
 * The default configuration-resolution algorithm — docs/ARCHITECTURE.md §10.5.
 *
 * 1. Prefer a *verified* configuration matching the requested (or user market
 *    context's, Armenia by default) spec region.
 * 2. Otherwise fall back to the GLOBAL spec region, verified or not.
 * 3. Otherwise there is no configuration for this (variant, year) at all.
 *
 * Every caller gets the resolved spec region back explicitly — never just the
 * configuration — because the Vehicle page must always render which region the
 * displayed specs actually came from (the mandatory SpecDataSourceNotice).
 */
export async function resolveConfiguration(
  variantId: number,
  modelYear: number,
  requestedSpecRegionCode?: string,
): Promise<ResolvedConfiguration | null> {
  const preferredCode = requestedSpecRegionCode ?? (await getPrimaryMarketCode());
  const supabase = await createClient();

  if (preferredCode !== GLOBAL_SPEC_REGION) {
    const { data, error } = await supabase
      .from("vehicle_configurations")
      .select("id, variant_id, model_year, spec_revision_id, is_verified, spec_regions!inner(code)")
      .eq("variant_id", variantId)
      .eq("model_year", modelYear)
      .eq("spec_regions.code", preferredCode)
      .eq("is_verified", true)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const configuration = toConfiguration(data);
      return { configuration, specRegionCode: configuration.specRegionCode, isVerified: true };
    }
  }

  const { data, error } = await supabase
    .from("vehicle_configurations")
    .select("id, variant_id, model_year, spec_revision_id, is_verified, spec_regions!inner(code)")
    .eq("variant_id", variantId)
    .eq("model_year", modelYear)
    .eq("spec_regions.code", GLOBAL_SPEC_REGION)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const configuration = toConfiguration(data);
  return {
    configuration,
    specRegionCode: configuration.specRegionCode,
    isVerified: configuration.isVerified,
  };
}

/** All distinct model years a variant has at least one configuration for, most
 *  recent first — what the year-less variant overview page lists (docs/ARCHITECTURE.md
 *  §7.1). */
export async function listModelYearsForVariant(variantId: number): Promise<number[]> {
  const configurations = await listConfigurationsForVariant(variantId);
  return [...new Set(configurations.map((c) => c.modelYear))].sort((a, b) => b - a);
}
