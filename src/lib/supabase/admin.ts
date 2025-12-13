import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

export const createSupabaseAdmin = () =>
  createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
