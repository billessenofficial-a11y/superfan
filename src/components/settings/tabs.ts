/** Plain module (no "use client") so server pages can read the tab list. */
export const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "scoring", label: "Scoring" },
  { value: "levels", label: "Levels" },
  { value: "team", label: "Team" },
  { value: "import", label: "Import" },
  { value: "audit", label: "Audit log" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

