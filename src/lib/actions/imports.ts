"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { importRows, imports } from "@/db/schema";
import { requireArtistAccess } from "@/lib/auth/context";
import { IMPORT_FIELDS, MAX_CSV_BYTES, runImport, stageImport } from "@/lib/csv/import";
import { act } from "./result";

const ALLOWED_TYPES = new Set(["text/csv", "text/plain", "application/vnd.ms-excel", "application/csv", ""]);

/** Stage a CSV upload (FormData: file, sourceLabel). Returns the import id + preview. */
export async function stageImportAction(formData: FormData) {
  return act(async () => {
    const ctx = await requireArtistAccess("importFans");
    const file = formData.get("file");
    const sourceLabel = String(formData.get("sourceLabel") ?? "").slice(0, 120) || undefined;
    if (!(file instanceof File)) throw Object.assign(new Error("Choose a CSV file."), { code: "validation" });
    if (!file.name.toLowerCase().endsWith(".csv") || !ALLOWED_TYPES.has(file.type)) {
      throw Object.assign(new Error("Only .csv files are supported."), { code: "validation" });
    }
    if (file.size > MAX_CSV_BYTES) throw Object.assign(new Error("CSV files must be under 10 MB."), { code: "validation" });
    const text = await file.text();
    const staged = await stageImport({ artistId: ctx.artist.id, fileName: file.name, csvText: text, sourceLabel, createdByUserId: ctx.user.id });
    revalidatePath("/app/settings");
    return { importId: staged.import.id, headers: staged.import.headers, mapping: staged.import.mapping, rowCount: staged.import.rowCount, preview: staged.preview, truncated: staged.truncated };
  });
}

const mappingSchema = z.record(z.string(), z.union([z.enum(IMPORT_FIELDS.map((f) => f.key) as [string, ...string[]]), z.null()]));

export async function runImportAction(input: { importId: string; mapping: Record<string, string | null> }) {
  return act(async () => {
    const ctx = await requireArtistAccess("importFans");
    const importId = z.string().uuid().parse(input.importId);
    const mapping = mappingSchema.parse(input.mapping);
    const done = await runImport({ artistId: ctx.artist.id, importId, mapping, actorUserId: ctx.user.id });
    revalidatePath("/app/fans");
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { imported: done.importedCount, skipped: done.skippedCount, failed: done.errorCount };
  });
}

export async function getImportStatus(input: { importId: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("importFans");
    const [row] = await db.select().from(imports).where(and(eq(imports.id, input.importId), eq(imports.artistId, ctx.artist.id))).limit(1);
    if (!row) throw Object.assign(new Error("Import not found."), { code: "not_found" });
    const errors = await db.select({ rowNumber: importRows.rowNumber, error: importRows.error }).from(importRows).where(and(eq(importRows.importId, row.id), eq(importRows.status, "failed"))).limit(20);
    return { status: row.status, processed: row.processedCount, imported: row.importedCount, skipped: row.skippedCount, failed: row.errorCount, rowCount: row.rowCount, errors };
  });
}
