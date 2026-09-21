import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Liveness + database reachability probe for deployments and uptime checks.
 * Never echoes connection strings; only the driver's error message.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "ok", latencyMs: Date.now() - started, demoMode: features.demoMode });
  } catch (err) {
    // Drizzle wraps driver errors; walk the cause chain so the real reason surfaces.
    const chain: string[] = [];
    for (let e: unknown = err; e instanceof Error && chain.length < 5; e = e.cause) chain.push(e.message);
    return NextResponse.json({ ok: false, db: chain.join(" <- ") || String(err), demoMode: features.demoMode }, { status: 503 });
  }
}
