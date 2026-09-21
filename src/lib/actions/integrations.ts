"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArtistAccess } from "@/lib/auth/context";
import { completeConnect, disconnectProvider, startConnect, syncProvider } from "@/lib/integrations/connect";
import { isIntegrationProvider } from "@/lib/integrations/registry";
import { normalizeShopDomain } from "@/lib/integrations/shopify";
import { act } from "./result";

const providerSchema = z.string().refine(isIntegrationProvider, "Unknown provider");

/**
 * Connect a provider. Live providers return an OAuth redirect URL; mock
 * providers connect immediately.
 */
export async function connectIntegrationAction(input: { provider: string; shop?: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageIntegrations");
    const provider = providerSchema.parse(input.provider);
    const params: Record<string, string> = {};
    if (provider === "shopify" && input.shop) {
      const shop = normalizeShopDomain(input.shop);
      if (!shop) throw Object.assign(new Error("Enter a valid myshopify.com domain."), { code: "validation" });
      params.shop = shop;
    }
    const res = await startConnect({ artistId: ctx.artist.id, provider, userId: ctx.user.id, params });
    revalidatePath("/app/integrations");
    return res;
  });
}

export async function completeIntegrationCallback(input: { provider: string; state: string; code: string; params?: Record<string, string> }) {
  const provider = providerSchema.parse(input.provider);
  return completeConnect({ provider, state: input.state, code: input.code, params: input.params });
}

export async function disconnectIntegrationAction(input: { provider: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageIntegrations");
    const provider = providerSchema.parse(input.provider);
    await disconnectProvider({ artistId: ctx.artist.id, provider, userId: ctx.user.id });
    revalidatePath("/app/integrations");
  });
}

export async function syncIntegrationAction(input: { provider: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageIntegrations");
    const provider = providerSchema.parse(input.provider);
    const res = await syncProvider({ artistId: ctx.artist.id, provider });
    revalidatePath("/app/integrations");
    return res;
  });
}
