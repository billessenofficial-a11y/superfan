import { and, eq, sql } from "drizzle-orm";
import Papa from "papaparse";
import { db as defaultDb, type Database } from "@/db";
import { fanIdentities, importRows, imports, type ImportColumnMapping } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { deterministicId } from "@/lib/crypto";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES, type FanEventInput } from "@/lib/events/types";
import { upsertIdentity } from "@/lib/identity/resolver";

export const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CSV_ROWS = 50_000;

/** Superfan fields a CSV column can be mapped to. */
export const IMPORT_FIELDS = [
  { key: "email", label: "Email", required: false, description: "Primary identifier. Rows without email or phone are skipped." },
  { key: "phone", label: "Phone", required: false },
  { key: "first_name", label: "First name", required: false },
  { key: "last_name", label: "Last name", required: false },
  { key: "full_name", label: "Full name", required: false, description: "Split into first/last when first_name is not mapped." },
  { key: "city", label: "City", required: false },
  { key: "region", label: "Region / State", required: false },
  { key: "country", label: "Country", required: false },
  { key: "instagram_username", label: "Instagram username", required: false, description: "Shown on the profile; never used to auto-merge." },
  { key: "order_total", label: "Order total ($)", required: false, description: "Creates an imported merch purchase." },
  { key: "orders_count", label: "Orders count", required: false },
  { key: "order_date", label: "Order date", required: false },
  { key: "event_name", label: "Event name", required: false, description: "Creates imported attendance / ticket purchase." },
  { key: "event_date", label: "Event date", required: false },
  { key: "ticket_quantity", label: "Ticket quantity", required: false },
  { key: "attended", label: "Attended (yes/no)", required: false, description: "When 'no', a ticket purchase is recorded instead of attendance." },
  { key: "source", label: "Source label", required: false },
  { key: "joined_at", label: "Member since", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

const HEADER_ALIASES: Record<string, ImportFieldKey> = {
  email: "email",
  "e-mail": "email",
  email_address: "email",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  first_name: "first_name",
  firstname: "first_name",
  "first name": "first_name",
  last_name: "last_name",
  lastname: "last_name",
  "last name": "last_name",
  name: "full_name",
  full_name: "full_name",
  customer_name: "full_name",
  city: "city",
  town: "city",
  region: "region",
  state: "region",
  province: "region",
  country: "country",
  instagram: "instagram_username",
  instagram_username: "instagram_username",
  ig: "instagram_username",
  order_total: "order_total",
  total: "order_total",
  total_spent: "order_total",
  amount: "order_total",
  orders_count: "orders_count",
  orders: "orders_count",
  order_date: "order_date",
  event_name: "event_name",
  event: "event_name",
  show: "event_name",
  event_date: "event_date",
  date: "event_date",
  ticket_quantity: "ticket_quantity",
  tickets: "ticket_quantity",
  qty: "ticket_quantity",
  attended: "attended",
  checked_in: "attended",
  source: "source",
  joined_at: "joined_at",
  member_since: "joined_at",
  created_at: "joined_at",
};

/** Suggest a mapping from CSV headers to Superfan fields. */
export function suggestMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  const used = new Set<string>();
  for (const h of headers) {
    const norm = h.trim().toLowerCase().replace(/\s+/g, "_");
    const guess = HEADER_ALIASES[norm] ?? HEADER_ALIASES[h.trim().toLowerCase()];
    if (guess && !used.has(guess)) {
      mapping[h] = guess;
      used.add(guess);
    } else {
      mapping[h] = null;
    }
  }
  return mapping;
}

export type ParsedCsv = { headers: string[]; rows: Record<string, string>[]; truncated: boolean };

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = result.data.slice(0, MAX_CSV_ROWS);
  return { headers, rows, truncated: result.data.length > MAX_CSV_ROWS };
}

/** Stage an import: store rows and a suggested mapping; nothing is imported yet. */
export async function stageImport(
  input: { artistId: string; fileName: string; csvText: string; sourceLabel?: string; createdByUserId: string | null },
  conn: Database = defaultDb,
) {
  if (Buffer.byteLength(input.csvText, "utf8") > MAX_CSV_BYTES) throw new Error("CSV file is larger than 10 MB.");
  const parsed = parseCsv(input.csvText);
  if (parsed.headers.length === 0) throw new Error("Could not find a header row in this CSV.");
  if (parsed.rows.length === 0) throw new Error("This CSV has no data rows.");

  return conn.transaction(async (tx) => {
    const [record] = await tx
      .insert(imports)
      .values({
        artistId: input.artistId,
        fileName: input.fileName,
        sourceLabel: input.sourceLabel ?? null,
        status: "mapping",
        mapping: suggestMapping(parsed.headers),
        headers: parsed.headers,
        rowCount: parsed.rows.length,
        createdByUserId: input.createdByUserId,
      })
      .returning();

    const chunk = 500;
    for (let i = 0; i < parsed.rows.length; i += chunk) {
      await tx.insert(importRows).values(
        parsed.rows.slice(i, i + chunk).map((raw, j) => ({
          importId: record.id,
          artistId: input.artistId,
          rowNumber: i + j + 1,
          raw,
        })),
      );
    }
    return { import: record, preview: parsed.rows.slice(0, 5), truncated: parsed.truncated };
  });
}

function parseMoney(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function truthy(v: string | undefined): boolean | null {
  if (v == null || v === "") return null;
  return /^(y|yes|true|1|attended|checked)/i.test(v.trim());
}

type MappedRow = Partial<Record<ImportFieldKey, string>>;

function applyMapping(raw: Record<string, string>, mapping: ImportColumnMapping): MappedRow {
  const out: MappedRow = {};
  for (const [column, field] of Object.entries(mapping)) {
    if (!field) continue;
    const value = raw[column];
    if (value != null && String(value).trim() !== "") out[field as ImportFieldKey] = String(value).trim();
  }
  if (!out.first_name && out.full_name) {
    const [first, ...rest] = out.full_name.split(/\s+/);
    out.first_name = first;
    if (!out.last_name && rest.length) out.last_name = rest.join(" ");
  }
  return out;
}

/** Build the normalized events for one CSV row. */
export function rowToEvents(artistId: string, importId: string, rowNumber: number, row: MappedRow, sourceLabel: string | null): FanEventInput[] {
  const email = row.email && /\S+@\S+\.\S+/.test(row.email) ? row.email.toLowerCase() : undefined;
  const phone = row.phone;
  if (!email && !phone) return [];

  const profile = {
    firstName: row.first_name,
    lastName: row.last_name,
    city: row.city,
    region: row.region,
    country: row.country,
  };
  const base = { artistId, source: "csv" as const, verification: "imported" as const, email, phone, profile };
  const rowKey = `${importId}:${rowNumber}`;
  const events: FanEventInput[] = [];
  const joinedAt = parseDate(row.joined_at);

  const orderTotal = parseMoney(row.order_total);
  if (orderTotal != null && orderTotal > 0) {
    const ordersCount = Math.max(1, Number(row.orders_count) || 1);
    events.push({
      ...base,
      type: EVENT_TYPES.csvMerchPurchase,
      sourceEventId: `import:${rowKey}:merch`,
      occurredAt: parseDate(row.order_date) ?? joinedAt ?? new Date(),
      metadata: { amountCents: orderTotal, ordersCount, importId, sourceLabel },
      summary: ordersCount > 1 ? `${ordersCount} imported merch orders ($${(orderTotal / 100).toFixed(2)})` : `Imported merch order ($${(orderTotal / 100).toFixed(2)})`,
    });
  }

  if (row.event_name) {
    const attended = truthy(row.attended);
    const qty = Math.max(1, Number(row.ticket_quantity) || 1);
    const occurredAt = parseDate(row.event_date) ?? new Date();
    if (attended === false) {
      events.push({
        ...base,
        type: EVENT_TYPES.csvTicketPurchase,
        sourceEventId: `import:${rowKey}:ticket`,
        occurredAt,
        metadata: { eventName: row.event_name, ticketQuantity: qty, importId, sourceLabel, eventId: deterministicId(["event", artistId, row.event_name]) },
        summary: `Bought ${qty > 1 ? `${qty} tickets` : "a ticket"} to ${row.event_name}`,
      });
    } else {
      events.push({
        ...base,
        type: EVENT_TYPES.eventAttendanceImported,
        sourceEventId: `import:${rowKey}:attendance`,
        occurredAt,
        metadata: { eventName: row.event_name, ticketQuantity: qty, importId, sourceLabel },
        summary: `Attended ${row.event_name}`,
      });
    }
  }

  if (events.length === 0) {
    events.push({
      ...base,
      type: EVENT_TYPES.csvFanImported,
      sourceEventId: `import:${rowKey}:fan`,
      occurredAt: joinedAt ?? new Date(),
      metadata: { importId, sourceLabel },
      summary: sourceLabel ? `Imported from ${sourceLabel}` : "Imported from CSV",
    });
  }
  return events;
}

/**
 * Process a staged import with the confirmed mapping. Re-runnable: rows are
 * processed once and events are idempotent by row.
 */
export async function runImport(
  input: { artistId: string; importId: string; mapping: ImportColumnMapping; actorUserId: string | null },
  conn: Database = defaultDb,
) {
  const [record] = await conn
    .select()
    .from(imports)
    .where(and(eq(imports.id, input.importId), eq(imports.artistId, input.artistId)))
    .limit(1);
  if (!record) throw new Error("Import not found");

  const hasIdentifier = Object.values(input.mapping).some((f) => f === "email" || f === "phone");
  if (!hasIdentifier) throw new Error("Map at least one column to Email or Phone.");

  await conn.update(imports).set({ mapping: input.mapping, status: "processing" }).where(eq(imports.id, record.id));

  const rows = await conn
    .select()
    .from(importRows)
    .where(and(eq(importRows.importId, record.id), eq(importRows.status, "pending")))
    .orderBy(importRows.rowNumber);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const mapped = applyMapping(row.raw, input.mapping);
    const events = rowToEvents(input.artistId, record.id, row.rowNumber, mapped, record.sourceLabel);
    if (events.length === 0) {
      skipped++;
      await conn.update(importRows).set({ status: "skipped", error: "No email or phone" }).where(eq(importRows.id, row.id));
      continue;
    }
    try {
      let fanId: string | null = null;
      await conn.transaction(async (tx) => {
        for (const ev of events) {
          const res = await ingestEvent(ev, tx);
          fanId = res.fanId ?? fanId;
        }
        if (fanId && mapped.instagram_username) {
          const username = mapped.instagram_username.replace(/^@/, "").toLowerCase();
          const identity = await upsertIdentity(tx, input.artistId, {
            provider: "instagram",
            externalUserId: `username:${username}`,
            username,
            verified: false,
            metadata: { importedFrom: record.id },
          });
          if (!identity.fanId) {
            await tx.update(fanIdentities).set({ fanId, claimed: true, claimedAt: new Date() }).where(eq(fanIdentities.id, identity.id));
          }
        }
      });
      imported++;
      await conn.update(importRows).set({ status: "imported", fanId }).where(eq(importRows.id, row.id));
    } catch (err) {
      failed++;
      await conn
        .update(importRows)
        .set({ status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "Unknown error" })
        .where(eq(importRows.id, row.id));
    }
    await conn
      .update(imports)
      .set({ processedCount: sql`${imports.processedCount} + 1`, importedCount: imported, skippedCount: skipped, errorCount: failed })
      .where(eq(imports.id, record.id));
  }

  const [done] = await conn
    .update(imports)
    .set({ status: "completed", completedAt: new Date(), importedCount: imported, skippedCount: skipped, errorCount: failed })
    .where(eq(imports.id, record.id))
    .returning();

  await audit(conn, {
    artistId: input.artistId,
    actorUserId: input.actorUserId,
    action: "csv.imported",
    targetType: "import",
    targetId: record.id,
    metadata: { fileName: record.fileName, imported, skipped, failed },
  });
  await track(conn, "fan_import_completed", { artistId: input.artistId, userId: input.actorUserId }, { imported, skipped, failed });

  return done;
}
