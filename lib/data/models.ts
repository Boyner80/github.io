import { createClient } from "@/lib/supabase/server";
import { getMakeBySlug } from "@/lib/data/makes";
import type { Model } from "@/lib/data/types";

function toModel(row: { id: number; slug: string; name: string; make_id: number }): Model {
  return { id: row.id, slug: row.slug, name: row.name, makeId: row.make_id };
}

export async function listModelsForMake(makeId: number): Promise<Model[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select("id, slug, name, make_id")
    .eq("make_id", makeId)
    .order("name");

  if (error) throw error;
  return data.map(toModel);
}

/**
 * Resolves a model via its parent make's slug — the shape every
 * /cars/[make]/[model] route needs. Two sequential lookups (make, then model)
 * rather than a single embedded-resource query: simple, unambiguous, and doesn't
 * depend on PostgREST's embedded-filter syntax behaving a particular way.
 */
export async function getModelBySlug(makeSlug: string, modelSlug: string): Promise<Model | null> {
  const make = await getMakeBySlug(makeSlug);
  if (!make) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select("id, slug, name, make_id")
    .eq("make_id", make.id)
    .eq("slug", modelSlug)
    .maybeSingle();

  if (error) throw error;
  return data ? toModel(data) : null;
}
