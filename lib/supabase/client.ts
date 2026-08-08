import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Browser-side Supabase client, for the small set of Client Components that
 * need one directly (e.g. a future auth form). Catalog data in V1 is always
 * fetched server-side via lib/data/* + lib/supabase/server.ts — this client
 * is not used for catalog reads.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
