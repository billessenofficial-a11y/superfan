"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { exportFansCsv } from "@/lib/actions/fans";
import type { FanListFilters } from "@/lib/fans/queries";

/** Exports the current filtered fan list as a CSV downloaded client-side. */
export function ExportFansButton({ filters, fileName = "fans.csv" }: { filters: FanListFilters; fileName?: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await exportFansCsv(filters);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast.success(`Exported ${res.data.count.toLocaleString()} fans`);
        })
      }
    >
      <Download />
      Export CSV
    </Button>
  );
}
