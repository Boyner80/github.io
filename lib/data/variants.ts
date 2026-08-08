import { createClient } from "@/lib/supabase/server";
import { getGenerationBySlug } from "@/lib/data/generations";
import type { Variant } from "@/lib/data/types";

function toVariant(row: {
  id: number;
  slug: string;
  name: string;
  trim_level: string | null;
  generation_id: number;
}): Variant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    trimLevel: row.trim_level,
    generationId: row.generation_id,
  };
}

export async function listVariantsForGeneration(generationId: number): Promise<Variant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("id, slug, name, trim_level, generation_id")
    .eq("generation_id", generationId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data.map(toVariant);
}

export async function getVariantBySlug(
  makeSlug: string,
  modelSlug: string,
  generationSlug: string,
  variantSlug: string,
): Promise<Variant | null> {
  const generation = await getGenerationBySlug(makeSlug, modelSlug, generationSlug);
  if (!generation) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("id, slug, name, trim_level, generation_id")
    .eq("generation_id", generation.id)
    .eq("slug", variantSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? toVariant(data) : null;
}
