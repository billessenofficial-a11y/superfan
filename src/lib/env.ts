import { z } from "zod";

/**
 * Server-side environment. Everything optional except DATABASE_URL so the app
 * can boot in demo mode with nothing but a Postgres connection.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/superfan"),
  SUPERFAN_DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  SUPERFAN_SIGNING_SECRET: z.string().optional(),
  SUPERFAN_ENCRYPTION_KEY: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("Superfan <hello@superfan.app>"),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default("2026-07"),

  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),

  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),

  TICKETMASTER_API_KEY: z.string().optional(),
});

function clean(v: string | undefined) {
  return v && v.trim().length > 0 ? v : undefined;
}

const raw = Object.fromEntries(
  Object.keys(serverSchema.shape).map((k) => [k, clean(process.env[k])]),
);

export const env = serverSchema.parse(raw);

export const isProduction = env.NODE_ENV === "production";
/**
 * Demo mode is an explicit opt-in (SUPERFAN_DEMO_MODE=true). It enables the
 * seeded Luma Vale workspace, one-click demo sign-in and the demo event menu.
 * Never enable it on a deployment that holds real fan data.
 */
export const isDemoMode = env.SUPERFAN_DEMO_MODE;

/** Feature flags derived from configured credentials. */
export const features = {
  supabaseAuth: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  resend: Boolean(env.RESEND_API_KEY),
  instagram: Boolean(env.META_APP_ID && env.META_APP_SECRET),
  shopify: Boolean(env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET),
  spotify: Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET),
  tiktok: Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
  ticketmasterDiscovery: Boolean(env.TICKETMASTER_API_KEY),
  demoMode: isDemoMode,
} as const;

export type FeatureFlags = typeof features;

/**
 * Signing secret. In production this must be set; in development we fall
 * back to a deterministic dev secret so the app boots with zero config.
 */
export function signingSecret(): string {
  if (env.SUPERFAN_SIGNING_SECRET) return env.SUPERFAN_SIGNING_SECRET;
  if (isProduction) {
    throw new Error("SUPERFAN_SIGNING_SECRET must be set in production");
  }
  return "superfan-dev-signing-secret-do-not-use-in-production";
}

export function encryptionKey(): string {
  if (env.SUPERFAN_ENCRYPTION_KEY) return env.SUPERFAN_ENCRYPTION_KEY;
  if (isProduction) {
    throw new Error("SUPERFAN_ENCRYPTION_KEY must be set in production");
  }
  return "0".repeat(64);
}

export function appUrl(path = ""): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
