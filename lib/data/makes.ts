import { createClient } from "@/lib/supabase/server";
import type { Make } from "@/lib/data/types";

function toMake(row: {
  id: number;
  slug: string;
  name: string;
  country: string | null;
  logo_url: string | null;
}): Make {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    logoUrl: row.logo_url,
  };
}

export async function listMakes(): Promise<Make[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("makes")
    .select("id, slug, name, country, logo_url")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data.map(toMake);
}

export async function getMakeBySlug(slug: string): Promise<Make | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("makes")
    .select("id, slug, name, country, logo_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? toMake(data) : null;
}
