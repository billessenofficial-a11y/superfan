"use client";

import { BadgeCheck } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { ProviderIcon, PROVIDER_LABELS } from "@/components/shared/provider-icon";
import { Badge } from "@/components/ui/badge";
import { disconnectIdentityAction } from "@/lib/actions/fan";
import { cn, formatDate } from "@/lib/utils";

export type IdentityItem = { id: string; provider: string; username: string | null; displayName: string | null; claimed: boolean; claimedAt: Date | null; artistName: string | null };

export function ConnectedIdentities({ identities }: { identities: IdentityItem[] }) {
  return (
    <section className="card-surface p-5">
      <h2 className="text-sm font-semibold tracking-tight">Connected identities</h2>
      <p className="text-xs text-muted-foreground">Accounts linked to your passport. Disconnecting keeps your history but stops new activity from counting.</p>
      {identities.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">No accounts linked yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {identities.map((id) => (
            <li key={id.id} className="flex items-center gap-3 py-3">
              <span className={cn("flex size-9 items-center justify-center rounded-xl", id.claimed ? "bg-artist/10 text-artist" : "bg-muted text-subtle")}>
                <ProviderIcon provider={id.provider} size={16} />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {PROVIDER_LABELS[id.provider] ?? id.provider}
                  {id.claimed ? (
                    <Badge variant="success">
                      <BadgeCheck /> Claimed
                    </Badge>
                  ) : (
                    <Badge variant="outline">Disconnected</Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {id.username ? `@${id.username}` : (id.displayName ?? "—")}
                  {id.artistName ? ` · via ${id.artistName}` : ""}
                  {id.claimedAt ? ` · ${formatDate(id.claimedAt, { month: "short", year: "numeric" })}` : ""}
                </p>
              </div>
              {id.provider !== "email" && id.claimed ? (
                <ActionButton size="sm" variant="ghost" action={() => disconnectIdentityAction({ identityId: id.id })} confirm={`Disconnect ${PROVIDER_LABELS[id.provider] ?? id.provider}? Your past activity stays on your passport.`} successMessage="Disconnected">
                  Disconnect
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
