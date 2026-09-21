"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { THEMES, THEME_COOKIE } from "@/lib/theme";
import { act } from "./result";

const schema = z.object({ theme: z.enum(THEMES) });

/** Persist the dashboard theme for a year. Readable by the client so the toggle can hydrate without a round-trip. */
export async function setThemeAction(input: z.input<typeof schema>) {
  return act(async () => {
    const { theme } = schema.parse(input);
    const store = await cookies();
    store.set(THEME_COOKIE, theme, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return { theme };
  });
}
