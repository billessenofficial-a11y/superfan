"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileSpreadsheet, Loader2 } from "lucide-react";
import { createArtistAction } from "@/lib/actions/artist";
import { connectIntegrationAction } from "@/lib/actions/integrations";
import { slugify } from "@/lib/artists/create";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ProviderIcon } from "@/components/shared/provider-icon";

type Step = 1 | 2 | 3 | 4;

const GENRES = ["Pop", "Alt-pop", "Hip-hop", "R&B", "Rock", "Indie", "Electronic", "Country", "Latin", "Metal", "Jazz", "Other"];

export function ArtistOnboarding({ hasArtist }: { hasArtist: boolean }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(hasArtist ? 3 : 1);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [genre, setGenre] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [accent, setAccent] = React.useState("#8b5cf6");
  const [pending, start] = React.useTransition();
  const [connected, setConnected] = React.useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = React.useState<string | null>(null);

  const create = () =>
    start(async () => {
      const res = await createArtistAction({ name, slug, genre: genre || undefined, country: country || undefined, accentColor: accent });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStep(3);
    });

  const connect = (provider: "instagram" | "shopify") => {
    setConnecting(provider);
    start(async () => {
      const res = await connectIntegrationAction({ provider });
      setConnecting(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.kind === "redirect") {
        window.location.href = res.data.url;
        return;
      }
      setConnected((c) => ({ ...c, [provider]: true }));
      toast.success(`${provider === "instagram" ? "Instagram" : "Shopify"} connected${res.data.mock ? " (mock)" : ""}`);
    });
  };

  const finish = () => {
    setStep(4);
    setTimeout(() => router.push("/app?welcome=1"), 2400);
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <ol className="mb-10 flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <li key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? "w-8 bg-accent" : "w-4 bg-border-strong"}`} />
        ))}
      </ol>

      {step === 1 ? (
        <div className="animate-rise text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">Know your real fans.</h1>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground text-balance">Connect your fanbase across commerce, community and real-world experiences.</p>
          <Button size="lg" className="mt-10" onClick={() => setStep(2)}>
            Get started <ArrowRight />
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="animate-rise">
          <h1 className="text-2xl font-semibold tracking-tight">Create artist</h1>
          <p className="mt-1 text-sm text-muted-foreground">This is the workspace your team will share.</p>
          <form
            className="mt-8 flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <Field label="Artist name" htmlFor="name">
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="Luma Vale"
                autoFocus
              />
            </Field>
            <Field label="Artist URL" htmlFor="slug" hint={`superfan.app/artists/${slug || "your-name"}`}>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Genre" htmlFor="genre">
                <select id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="h-10 rounded-xl border border-input bg-card px-3 text-sm">
                  <option value="">Select…</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Country" htmlFor="country">
                <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" />
              </Field>
            </div>
            <Field label="Accent color" hint="Used on your fans' passports.">
              <div className="flex items-center gap-3">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="size-10 cursor-pointer rounded-lg border border-input bg-transparent p-1" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-32 font-mono" />
              </div>
            </Field>
            <Button type="submit" size="lg" loading={pending} className="mt-2">
              Create workspace <ArrowRight />
            </Button>
          </form>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="animate-rise">
          <h1 className="text-2xl font-semibold tracking-tight">Connect your audience</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every source becomes one fan identity. You can add more later.</p>
          <div className="mt-8 flex flex-col gap-3">
            {(
              [
                { key: "instagram", label: "Instagram", desc: "Comments, DMs and mentions on your professional account." },
                { key: "shopify", label: "Shopify", desc: "Orders and customers from your merch store." },
              ] as const
            ).map((p) => (
              <div key={p.key} className="card-surface flex items-center gap-4 px-4 py-3.5">
                <ProviderIcon provider={p.key} size={22} className="text-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                {connected[p.key] ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Check className="size-3.5" /> Connected
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => connect(p.key)} loading={connecting === p.key}>
                    Connect
                  </Button>
                )}
              </div>
            ))}
            <div className="card-surface flex items-center gap-4 px-4 py-3.5">
              <FileSpreadsheet className="size-[22px] text-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Import CSV</p>
                <p className="text-xs text-muted-foreground">Mailing lists, ticket buyers, merch customers.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push("/app/settings?tab=import")}>
                Import
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-dashed border-border p-3">
                <ProviderIcon provider="spotify" className="mx-auto mb-1" /> Spotify
                <div className="text-[10px] text-subtle">Coming later</div>
              </div>
              <div className="rounded-xl border border-dashed border-border p-3">
                <ProviderIcon provider="tiktok" className="mx-auto mb-1" /> TikTok
                <div className="text-[10px] text-subtle">Coming later</div>
              </div>
              <div className="rounded-xl border border-dashed border-border p-3">
                <ProviderIcon provider="ticketmaster" className="mx-auto mb-1" /> Ticketmaster
                <div className="text-[10px] text-subtle">Partner integration</div>
              </div>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={finish}>
              Skip for now
            </button>
            <Button size="lg" onClick={finish}>
              Continue <ArrowRight />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="animate-rise flex flex-col items-center text-center">
          <div className="relative mb-8 flex size-24 items-center justify-center">
            <span className="absolute inset-0 animate-pulse-soft rounded-full bg-accent-soft" />
            <Loader2 className="relative size-8 animate-spin text-accent" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Your fanbase is syncing…</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">We&apos;re building fan profiles from every connected source. This keeps running in the background.</p>
        </div>
      ) : null}
    </div>
  );
}
