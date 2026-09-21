import { cache } from "react";
import { getPassport } from "./passport";

/**
 * Per-request memoized passport loader so the /fan/[artistSlug] layout and
 * its pages share one query.
 */
export const loadPassport = cache(async (fanId: string, slug: string) => getPassport(fanId, slug));
