import { createClient } from "@supabase/supabase-js";

/**
 * Connection to the EXISTING external Supabase project.
 * The publishable key is public by design (NOT service_role); all access is enforced by RLS
 * and the `task-command` edge function on the server.
 */
const FALLBACK_SUPABASE_URL = "https://oyrpoxnmprwomcbkjgfv.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ccp76s-L8jcKJ4DiFQI49Q_M1nvD-pN";

export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

export const ASSET_BUCKET = "task-assets";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});