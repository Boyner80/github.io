import { createClient } from "@/lib/supabase/server";
import { getModelBySlug } from "@/lib/data/models";
import type { Generation } from "@/lib/data/types";

function toGeneration(row: {
  id: number;
  slug: string;
  code: string | null;
  name: string | null;
  production_start_year: number;
  production_end_year: number | null;
  model_id: number;
}): Generation {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    name: row.name,
    productionStartYear: row.production_start_year,
    productionEndYear: row.production_end_year,
    modelId: row.model_id,
  };
}

export async function listGenerationsForModel(modelId: number): Promise<Generation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select("id, slug, code, name, production_start_year, production_end_year, model_id")
    .eq("model_id", modelId)
    .order("production_start_year", { ascending: false });

  if (error) throw error;
  return data.map(toGeneration);
}

export async function getGenerationBySlug(
  makeSlug: string,
  modelSlug: string,
  generationSlug: string,
): Promise<Generation | null> {
  const model = await getModelBySlug(makeSlug, modelSlug);
  if (!model) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select("id, slug, code, name, production_start_year, production_end_year, model_id")
    .eq("model_id", model.id)
    .eq("slug", generationSlug)
    .maybeSingle();

  if (error) throw error;
  return data ? toGeneration(data) : null;
}
