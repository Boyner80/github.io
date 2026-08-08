/**
 * Contract for a provider-specific ingestion adapter — docs/ARCHITECTURE.md §12.
 *
 * No adapter implements this yet: Phase 1 seeds a small hand-entered development
 * dataset directly via SQL (supabase/seed/dev-seed.sql), not through this pipeline.
 * This file exists so a future NHTSA vPIC adapter (or any other provider) has a
 * clear shape to implement against, without designing that shape against a
 * hypothetical response format before a real one is being integrated.
 *
 * An adapter is the ONLY code allowed to know a provider's response shape. It
 * must return data already reshaped into these input types — never the
 * provider's raw field names — and writes through lib/data/*, the same
 * repository layer the app reads through, recording one external_source_mappings
 * row per canonical entity it creates or updates.
 */

export type CatalogEntityType =
  | "make"
  | "model"
  | "generation"
  | "variant"
  | "vehicle_configuration"
  | "engine"
  | "spec_revision";

/** One provider record, already identified — but not yet transformed. */
export interface SourceRecord<TPayload = unknown> {
  externalId: string;
  externalUrl?: string;
  fetchedAt: string; // ISO 8601
  payload: TPayload;
}

export interface MakeInput {
  slug: string;
  name: string;
  country?: string | null;
}

export interface ModelInput {
  makeSlug: string;
  slug: string;
  name: string;
}

export interface GenerationInput {
  makeSlug: string;
  modelSlug: string;
  slug: string;
  code?: string | null;
  name?: string | null;
  productionStartYear: number;
  productionEndYear?: number | null;
}

export interface VariantInput {
  makeSlug: string;
  modelSlug: string;
  generationSlug: string;
  slug: string;
  name: string;
  trimLevel?: string | null;
}

/**
 * A single adapter run's output: canonical inputs, each paired with the source
 * record it came from so the caller can write the matching
 * external_source_mappings row. Deliberately flat and provider-agnostic — an
 * adapter never returns provider-shaped objects here.
 */
export interface AdapterResult {
  makes: Array<{ input: MakeInput; source: SourceRecord }>;
  models: Array<{ input: ModelInput; source: SourceRecord }>;
  generations: Array<{ input: GenerationInput; source: SourceRecord }>;
  variants: Array<{ input: VariantInput; source: SourceRecord }>;
  // Spec/configuration inputs are intentionally not modeled yet — the shape
  // depends on decisions (e.g. how a real provider expresses model-year and
  // spec-region granularity) that won't be known until the first real adapter
  // is built. Extend this interface then, not speculatively now.
}

export interface CatalogIngestionAdapter {
  /** Matches a data_sources.code row — docs/DATABASE_SCHEMA.md §8. */
  readonly sourceCode: string;
  run(): Promise<AdapterResult>;
}
