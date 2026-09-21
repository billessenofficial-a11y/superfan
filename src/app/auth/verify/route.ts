import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createLocalSessionToken, LOCAL_SESSION_COOKIE, localSessionCookieOptions, verifyLocalMagicLink } from "@/lib/auth/local";
import { appUrl, features } from "@/lib/env";

/** Local development magic-link verification (Supabase handles this in /auth/callback). */
export async function GET(req: NextRequest) {
  if (features.supabaseAuth) return NextResponse.redirect(appUrl("/login?error=unsupported"));
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(appUrl("/login?error=invalid_link"));
  const result = await verifyLocalMagicLink(token);
  if (!result) return NextResponse.redirect(appUrl("/login?error=expired_link"));
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_SESSION_COOKIE, createLocalSessionToken(result.user), localSessionCookieOptions);
  const next = result.redirectTo && result.redirectTo.startsWith("/") && !result.redirectTo.startsWith("//") ? result.redirectTo : "/fan";
  return NextResponse.redirect(appUrl(next));
}
