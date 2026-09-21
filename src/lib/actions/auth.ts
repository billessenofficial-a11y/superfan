"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ARTIST_COOKIE, listMemberships } from "@/lib/auth/context";
import { createLocalSessionToken, LOCAL_SESSION_COOKIE, localSessionCookieOptions, requestLocalMagicLink, upsertUserByEmail } from "@/lib/auth/local";
import { getSessionUser, signOut } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { appUrl, features, isDemoMode } from "@/lib/env";
import { act } from "./result";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  next: z.string().max(500).optional(),
  artistName: z.string().max(120).optional(),
});

function safeNext(next: string | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/** Send a passwordless magic link via Supabase or the local provider. */
export async function requestMagicLink(input: { email: string; next?: string; artistName?: string }) {
  return act(async () => {
    const { email, next, artistName } = emailSchema.parse(input);
    const redirectTo = safeNext(next, "/fan");
    if (features.supabaseAuth) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(redirectTo)}`) },
      });
      if (error) throw new Error(error.message);
      return { delivered: true as const, devLink: undefined };
    }
    const res = await requestLocalMagicLink({ email, redirectTo, artistName });
    return { delivered: res.delivered, devLink: res.devLink };
  });
}

/**
 * Demo-only instant sign-in (no email round trip). Available only when
 * SUPERFAN_DEMO_MODE=true and Supabase auth is not configured.
 */
export async function demoSignIn(input: { email: string; next?: string }) {
  if (!isDemoMode || features.supabaseAuth) return { ok: false as const, error: "Demo sign-in is disabled." };
  const { email, next } = emailSchema.parse(input);
  const user = await upsertUserByEmail(email);
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, createLocalSessionToken(user), localSessionCookieOptions);
  redirect(safeNext(next, "/app"));
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

/** Switch the active artist workspace (must be one of the user's memberships). */
export async function switchArtist(artistId: string) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const memberships = await listMemberships(user.id);
  if (!memberships.some((m) => m.artistId === artistId)) return;
  const cookieStore = await cookies();
  cookieStore.set(ARTIST_COOKIE, artistId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}
