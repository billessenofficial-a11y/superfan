"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { PROVIDER_LABELS } from "@/components/shared/provider-icon";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Shows the outcome of an OAuth round-trip (`?connected=shopify` or
 * `?error=...`) as a toast + dismissible banner, then cleans the URL.
 */
export function ConnectBanner({ connected, error }: { connected?: string; error?: string }) {
  const router = useRouter();
  const [dismissed, setDismissed] = React.useState(false);
  const label = connected ? (PROVIDER_LABELS[connected] ?? connected) : null;

  React.useEffect(() => {
    if (label) toast.success(`${label} connected`, { description: "Events are flowing into Superfan." });
    else if (error) toast.error("Connection failed", { description: error });
  }, [label, error]);

  if (dismissed || (!label && !error)) return null;
  const success = Boolean(label);

  return (
    <div className={cn("mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm animate-rise", success ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger")} role="status">
      {success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{success ? `${label} is connected` : "We could not complete the connection"}</p>
        <p className="text-xs opacity-80">{success ? "Recent activity will start appearing in your fan profiles shortly." : error}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
        onClick={() => {
          setDismissed(true);
          router.replace("/app/integrations");
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
