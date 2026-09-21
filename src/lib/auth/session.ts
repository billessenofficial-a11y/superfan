import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { features } from "@/lib/env";
import { LOCAL_SESSION_COOKIE, readLocalSession, upsertUserByEmail } from "./local";
import { createSupabaseServerClient } from "./supabase";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * The authenticated application user for this request, or null.
 * Resolves through Supabase Auth when configured, otherwise through the
 * local development session cookie. Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (features.supabaseAuth) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return null;
    // Mirror auth.users into public.users keyed by the same id.
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (row) return { id: row.id, email: row.email, displayName: row.displayName, avatarUrl: row.avatarUrl };
    const [created] = await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email.toLowerCase(),
        displayName: (user.user_metadata?.full_name as string | undefined) ?? null,
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        lastSignInAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (created) return { id: created.id, email: created.email, displayName: created.displayName, avatarUrl: created.avatarUrl };
    // Email collision with a pre-existing local user: adopt that record.
    const adopted = await upsertUserByEmail(user.email);
    return { id: adopted.id, email: adopted.email, displayName: adopted.displayName, avatarUrl: adopted.avatarUrl };
  }

  const cookieStore = await cookies();
  const session = readLocalSession(cookieStore.get(LOCAL_SESSION_COOKIE)?.value);
  if (!session) return null;
  const [row] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.displayName, avatarUrl: row.avatarUrl };
});

export async function signOut() {
  const cookieStore = await cookies();
  if (features.supabaseAuth) {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  }
  cookieStore.delete(LOCAL_SESSION_COOKIE);
  cookieStore.delete("sf_artist");
}
