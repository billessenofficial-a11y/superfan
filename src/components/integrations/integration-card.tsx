"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, EyeOff, FlaskConical, Plug, RefreshCw, Unplug } from "lucide-react";
import { connectIntegrationAction, disconnectIntegrationAction, syncIntegrationAction } from "@/lib/actions/integrations";
import type { IntegrationProvider, IntegrationStatus, ProviderAvailability } from "@/lib/integrations/types";
import { cn, formatRelative } from "@/lib/utils";
import { ActionButton } from "@/components/shared/action-button";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRunAction } from "@/components/programs/use-run-action";

export type IntegrationCardData = {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  capabilities: string[];
  doesNotTrack: string[];
  availability: ProviderAvailability;
  status: { title: string; detail: string; tone: "success" | "info" | "warning" | "danger" | "neutral" };
  connected: boolean;
  account: {
    status: IntegrationStatus;
    externalAccountName: string | null;
    lastEventAt: Date | null;
    lastSyncedAt: Date | null;
    connectedAt: Date | null;
    isMock: boolean;
    lastError: string | null;
  } | null;
};

const TONE_DOT: Record<IntegrationCardData["status"]["tone"], string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-border-strong",
};

const TONE_TEXT: Record<IntegrationCardData["status"]["tone"], string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-muted-foreground",
};

const BRAND_BG: Record<IntegrationProvider, string> = {
  instagram: "bg-gradient-to-br from-pink-500/25 to-orange-400/25 text-pink-300",
  shopify: "bg-emerald-500/15 text-emerald-300",
  ticketmaster: "bg-sky-500/15 text-sky-300",
  spotify: "bg-green-500/15 text-green-300",
  tiktok: "bg-foreground/10 text-foreground",
};

export function IntegrationCard({ data, canManage }: { data: IntegrationCardData; canManage: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const [shopPrompt, setShopPrompt] = React.useState(false);
  const [shop, setShop] = React.useState("");
  const { pending, run } = useRunAction();

  const { availability, account } = data;
  const isFanScoped = availability.scope === "fan";
  const isTicketmaster = data.provider === "ticketmaster";
  const unavailable = availability.mode === "unavailable";
  const needsReconnect = account?.status === "expired" || account?.status === "action_required" || account?.status === "failed";

  const connect = (params: { shop?: string } = {}) =>
    run(() => connectIntegrationAction({ provider: data.provider, ...params }), {
      onSuccess: (res) => {
        if (res.kind === "redirect") {
          window.location.href = res.url;
          return;
        }
        setShopPrompt(false);
      },
      success: (res) => (res.kind === "connected" ? `${data.displayName} connected${res.mock ? " (mock account)" : ""}` : "Redirecting…"),
      refresh: true,
    });

  const startConnect = () => {
    if (data.provider === "shopify" && availability.mode === "live") {
      setShopPrompt(true);
      return;
    }
    connect();
  };

  return (
    <Card className={cn("flex flex-col animate-rise", pending && "opacity-70")}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-4">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", BRAND_BG[data.provider])}>
            <ProviderIcon provider={data.provider} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold tracking-tight">{data.displayName}</h3>
              {availability.experimental ? (
                <Badge variant="warning">
                  <FlaskConical /> Experimental
                </Badge>
              ) : null}
              {account?.isMock && data.connected ? <Badge variant="info">Mock</Badge> : null}
              {isTicketmaster ? <Badge variant={availability.mode === "live" ? "success" : "outline"}>{availability.mode === "live" ? "Event Discovery enabled" : "Sample mode"}</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{data.description}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-3.5 py-2.5">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[data.status.tone], data.status.tone === "success" && "shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_25%,transparent)]")} />
          <div className="min-w-0 flex-1 text-xs">
            <p className={cn("font-medium", TONE_TEXT[data.status.tone])}>{data.status.title}</p>
            <p className="text-muted-foreground">{data.status.detail}</p>
            {data.connected && account ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-subtle">
                {account.externalAccountName ? (
                  <>
                    <dt>Account</dt>
                    <dd className="truncate font-medium text-foreground">{account.externalAccountName}</dd>
                  </>
                ) : null}
                <dt>Last event</dt>
                <dd className="text-foreground">{account.lastEventAt ? formatRelative(account.lastEventAt) : "none yet"}</dd>
                {data.provider === "shopify" ? (
                  <>
                    <dt>Last sync</dt>
                    <dd className="text-foreground">{account.lastSyncedAt ? formatRelative(account.lastSyncedAt) : "never"}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
          </div>
        </div>

        {isFanScoped ? <p className="text-xs text-muted-foreground">Fans connect from their passport once enabled. {availability.note}</p> : null}
        {isTicketmaster ? (
          <p className="text-xs text-muted-foreground">
            Purchase verification requires partner access.{" "}
            <Link href="/app/settings?tab=import" className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline">
              Import ticket buyers <ArrowRight className="size-3" />
            </Link>
          </p>
        ) : null}

        {shopPrompt ? (
          <form
            className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              connect({ shop });
            }}
          >
            <Input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="your-store.myshopify.com" autoFocus required className="h-9" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={pending}>
                Continue
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShopPrompt(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {canManage && !isTicketmaster ? (
            data.connected && !needsReconnect ? (
              <>
                {data.provider === "shopify" ? (
                  <ActionButton size="sm" variant="secondary" action={() => syncIntegrationAction({ provider: data.provider })} successMessage={(r) => (r.produced > 0 ? `Synced ${r.produced} new events` : (r.note ?? "Up to date"))}>
                    <RefreshCw className="size-3.5" /> Sync now
                  </ActionButton>
                ) : null}
                <ActionButton size="sm" variant="ghost" action={() => disconnectIntegrationAction({ provider: data.provider })} confirm={`Disconnect ${data.displayName}? New activity will stop flowing in; existing fan history is kept.`} successMessage={`${data.displayName} disconnected`}>
                  <Unplug className="size-3.5" /> Disconnect
                </ActionButton>
              </>
            ) : (
              <Button size="sm" onClick={startConnect} loading={pending} disabled={unavailable}>
                <Plug className="size-3.5" /> {needsReconnect ? "Reconnect" : "Connect"}
              </Button>
            )
          ) : null}
          {canManage && isTicketmaster ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/app/events">
                Create event from tour dates <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
            Manage <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="grid gap-4 border-t border-border px-5 py-4 text-xs sm:grid-cols-2 animate-fade-in">
          <div>
            <p className="mb-2 font-medium uppercase tracking-wide text-subtle">Tracks</p>
            <ul className="flex flex-col gap-1.5">
              {data.capabilities.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium uppercase tracking-wide text-subtle">Does not track</p>
            <ul className="flex flex-col gap-1.5 text-muted-foreground">
              {data.doesNotTrack.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <EyeOff className="mt-0.5 size-3.5 shrink-0" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-subtle sm:col-span-2">{availability.note}</p>
        </div>
      ) : null}
    </Card>
  );
}
