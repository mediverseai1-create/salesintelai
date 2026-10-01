// Public values are referenced statically so Next can inline them in the client bundle.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Server-only checks (these env vars are never exposed to the browser). */
export const serverEnv = {
  serviceRoleConfigured: () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  geminiConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-2.5-flash",
};
