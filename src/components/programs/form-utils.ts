/** Helpers shared by the program dialogs (rewards, challenges, events, campaigns). */

/** Date → value for `<input type="datetime-local">` in the browser's local time. */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value → ISO string, or "" when blank (actions treat "" as null). */
export function fromLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Text input → integer, or null when blank / not a number. */
export function intOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function intOr(value: string, fallback: number): number {
  return intOrNull(value) ?? fallback;
}

/** Client-safe copy of `fanDisplayName` (the queries module imports the DB client). */
export function fanName(f: { firstName: string | null; lastName: string | null; email?: string | null }, fallback = "Unknown fan"): string {
  const name = [f.firstName, f.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (f.email) return f.email.split("@")[0];
  return fallback;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Sentinel for "none" in Radix selects (empty string values are not allowed). */
export const NONE = "__none__";

export function fromSelect(value: string): string | null {
  return value === NONE ? null : value;
}

export function toSelect(value: string | null | undefined): string {
  return value ?? NONE;
}
