"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArtistAccess } from "@/lib/auth/context";
import { DEMO_EVENT_KINDS, generateDemoEvent } from "@/lib/demo/generate";
import { isDemoMode } from "@/lib/env";
import { act } from "./result";

const kindSchema = z.enum(DEMO_EVENT_KINDS.map((k) => k.key) as [string, ...string[]]);

/** Development-only: push one synthetic event through the real pipeline. */
export async function generateDemoEventAction(input: { kind: string }) {
  return act(async () => {
    if (!isDemoMode) throw Object.assign(new Error("Demo mode is disabled."), { code: "forbidden" });
    const ctx = await requireArtistAccess("viewFans");
    const kind = kindSchema.parse(input.kind) as (typeof DEMO_EVENT_KINDS)[number]["key"];
    const result = await generateDemoEvent(ctx.artist.id, kind, ctx.user.id);
    revalidatePath("/app", "layout");
    return result;
  });
}
