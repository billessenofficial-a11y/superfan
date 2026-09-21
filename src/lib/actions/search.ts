"use server";

import { z } from "zod";
import { requireArtistAccess } from "@/lib/auth/context";
import { searchFans } from "@/lib/fans/queries";
import { act } from "./result";

/** Debounced fan search (name, email, Instagram username, phone). */
export async function searchFansAction(input: { query: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("viewFans");
    const query = z.string().max(120).parse(input.query).trim();
    if (query.length < 2) return [];
    const rows = await searchFans(ctx.artist.id, query, 8);
    return rows.map((r) => ({
      fanId: r.fanId,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || r.instagramUsername || "Unknown fan",
      email: r.email,
      avatarUrl: r.avatarUrl,
      city: r.city,
      score: r.superfanScore,
      levelName: r.levelName,
      levelColor: r.levelColor,
      instagramUsername: r.instagramUsername,
    }));
  });
}
