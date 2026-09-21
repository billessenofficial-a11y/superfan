"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SETTINGS_TABS, type SettingsTab } from "./tabs";
export { SETTINGS_TABS, type SettingsTab };

/** Tab strip whose selection lives in `?tab=` so links and refreshes keep their place. */
export function SettingsTabs({ active }: { active: SettingsTab }) {
  const router = useRouter();
  return (
    <Tabs value={active} onValueChange={(v) => router.push(`/app/settings?tab=${v}`)}>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <TabsList>
          {SETTINGS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
