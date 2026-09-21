/** Pure helpers safe to import from client components. */
export function fanDisplayName(f: { firstName: string | null; lastName: string | null; email?: string | null }, fallback = "Unknown fan") {
  const name = [f.firstName, f.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (f.email) return f.email.split("@")[0];
  return fallback;
}
