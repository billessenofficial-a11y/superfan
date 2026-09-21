"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { deleteSegmentAction, refreshSegmentCount } from "@/lib/actions/segments";

export function RefreshCountButton({ id }: { id: string }) {
  return (
    <ActionButton variant="ghost" size="icon-sm" action={() => refreshSegmentCount({ id })} successMessage={(d) => `${d.count.toLocaleString()} fans match`} aria-label="Refresh count" title="Refresh count">
      <RefreshCw />
    </ActionButton>
  );
}

export function DeleteSegmentButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ActionButton variant="ghost" size="sm" action={() => deleteSegmentAction({ id })} confirm={`Delete segment “${name}”? Campaigns using it will lose their audience.`} successMessage="Segment deleted" onSuccess={() => router.refresh()} className="text-muted-foreground hover:text-danger">
      <Trash2 /> Delete
    </ActionButton>
  );
}
