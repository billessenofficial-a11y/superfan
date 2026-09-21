import { NextResponse, type NextRequest } from "next/server";
import { completeConnect, IntegrationError } from "@/lib/integrations/connect";
import { isIntegrationProvider } from "@/lib/integrations/registry";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

/**
 * OAuth callback for artist-scoped providers (Instagram via Meta, Shopify).
 * The `state` parameter is bound to the artist + user who started the flow,
 * so no session is required here.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const params = req.nextUrl.searchParams;
  const back = (query: string) => NextResponse.redirect(appUrl(`/app/integrations?${query}`));
  if (!isIntegrationProvider(provider)) return back("error=unknown_provider");

  const error = params.get("error") ?? params.get("error_description");
  if (error) return back(`error=${encodeURIComponent(error)}&provider=${provider}`);

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back(`error=${encodeURIComponent("Missing authorization code")}&provider=${provider}`);

  try {
    const extra: Record<string, string> = {};
    const shop = params.get("shop");
    if (shop) extra.shop = shop;
    await completeConnect({ provider, state, code, params: extra });
    return back(`connected=${provider}`);
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "The provider rejected the connection.";
    return back(`error=${encodeURIComponent(message)}&provider=${provider}`);
  }
}
