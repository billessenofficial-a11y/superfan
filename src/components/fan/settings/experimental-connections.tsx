import { FlaskConical } from "lucide-react";
import { ProviderIcon, PROVIDER_LABELS } from "@/components/shared/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProviderAvailability } from "@/lib/integrations/types";

export type ExperimentalProvider = { provider: "spotify" | "tiktok"; description: string; capabilities: string[]; doesNotTrack: string[]; availability: ProviderAvailability; connected: boolean };

export function ExperimentalConnections({ providers }: { providers: ExperimentalProvider[] }) {
  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Experimental connections</h2>
        <Badge variant="info">
          <FlaskConical /> Beta
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">Optional links that add a little to your score. We only read what we say we read.</p>
      <ul className="mt-4 space-y-3">
        {providers.map((p) => {
          const live = p.availability.mode === "live";
          return (
            <li key={p.provider} className="rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  <ProviderIcon provider={p.provider} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{PROVIDER_LABELS[p.provider]}</p>
                    {p.connected ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" disabled title={p.availability.note}>
                        {live ? "Connect" : "Coming soon"}
                      </Button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                  <div className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-success">We read</p>
                      <ul className="text-muted-foreground">
                        {p.capabilities.map((c) => (
                          <li key={c}>· {c}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-subtle">We never read</p>
                      <ul className="text-muted-foreground">
                        {p.doesNotTrack.map((c) => (
                          <li key={c}>· {c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-subtle">{p.availability.note}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
