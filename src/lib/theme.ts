/** Dashboard appearance. Stored in a cookie so the server renders the right theme with no flash. */
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "sf_theme";
export const DEFAULT_THEME: Theme = "dark";

export function parseTheme(value: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : DEFAULT_THEME;
}
