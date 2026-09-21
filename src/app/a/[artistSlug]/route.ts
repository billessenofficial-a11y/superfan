import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/env";

/** Canonical referral link format: /a/{artistSlug}?ref=CODE → join page. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ artistSlug: string }> }) {
  const { artistSlug } = await ctx.params;
  const ref = req.nextUrl.searchParams.get("ref");
  const slug = artistSlug.replace(/[^a-z0-9-]/gi, "").slice(0, 48);
  const query = ref ? `?ref=${encodeURIComponent(ref.toUpperCase().slice(0, 20))}` : "";
  return NextResponse.redirect(appUrl(`/artists/${slug}/join${query}`));
}
