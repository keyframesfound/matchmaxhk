type RuntimeEnv = Record<string, unknown>;

function getEnvValue(env: RuntimeEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function resolveSupabaseEnv(env: RuntimeEnv = {}) {
  return {
    url: getEnvValue(env, ["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]),
    publishableKey: getEnvValue(env, [
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]),
    serviceRoleKey: getEnvValue(env, ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]),
  };
}

export function getSupabaseMissingEnvMessage(missing: string[]): string {
  return `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in Vercel or your local .env file.`;
}
