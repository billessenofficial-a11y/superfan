import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, features } from "@/lib/env";

/**
 * Supabase server client bound to the request cookies. Only used when
 * NEXT_PUBLIC_SUPABASE_URL is configured; otherwise the local dev auth
 * provider handles sessions.
 */
export async function createSupabaseServerClient() {
  if (!features.supabaseAuth) return null;
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}

/** Service-role client for server-only admin operations (never exposed to the browser). */
export async function createSupabaseAdminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
