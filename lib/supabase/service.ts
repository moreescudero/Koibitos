import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la SERVICE ROLE KEY. Bypassa RLS.
 * SOLO se puede usar server-side (API routes). Nunca importar desde un
 * componente de cliente.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
