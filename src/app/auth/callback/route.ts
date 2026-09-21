import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase";
import { appUrl, features } from "@/lib/env";

/** Supabase Auth callback: exchanges the PKCE code for a session cookie. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawNext = params.get("next") ?? "/fan";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/fan";
  if (!features.supabaseAuth) return NextResponse.redirect(appUrl(next));
  const code = params.get("code");
  if (!code) return NextResponse.redirect(appUrl("/login?error=invalid_link"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase!.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(appUrl("/login?error=expired_link"));
  return NextResponse.redirect(appUrl(next));
}
