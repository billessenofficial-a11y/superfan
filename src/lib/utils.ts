import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");

export function formatNumber(n: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (n == null) return "—";
  return opts.compact && Math.abs(n) >= 10_000 ? compact.format(n) : full.format(n);
}

export function formatMoney(cents: number | null | undefined, opts: { compact?: boolean; currency?: string } = {}) {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (opts.compact && Math.abs(dollars) >= 10_000) return `$${compact.format(dollars)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: opts.currency ?? "USD", maximumFractionDigits: dollars % 1 === 0 ? 0 : 2 }).format(dollars);
}

export function formatPercent(n: number, digits = 1) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return future ? `in ${months}mo` : `${months}mo ago`;
  const years = Math.round(months / 12);
  return future ? `in ${years}y` : `${years}y ago`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Stable pastel gradient from a string, for avatar fallbacks. */
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 40 + (h % 60)) % 360;
  return `linear-gradient(135deg, hsl(${a} 70% 60%), hsl(${b} 70% 50%))`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function pluralize(n: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

export function truncate(s: string, max = 80) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function isUuid(s: string | undefined | null): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
