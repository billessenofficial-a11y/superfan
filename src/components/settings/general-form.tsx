"use client";

import * as React from "react";
import { updateArtistAction } from "@/lib/actions/artist";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { intOr } from "@/components/programs/form-utils";
import { useRunAction } from "@/components/programs/use-run-action";

type ArtistSettings = {
  name: string;
  slug: string;
  genre: string | null;
  country: string | null;
  bio: string | null;
  accentColor: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followerCount: number;
  pointsPerDollar: number;
  referralPoints: number;
};

export function GeneralForm({ artist, canManage }: { artist: ArtistSettings; canManage: boolean }) {
  const [form, setForm] = React.useState({
    name: artist.name,
    genre: artist.genre ?? "",
    country: artist.country ?? "",
    bio: artist.bio ?? "",
    accentColor: artist.accentColor,
    avatarUrl: artist.avatarUrl ?? "",
    bannerUrl: artist.bannerUrl ?? "",
    followerCount: String(artist.followerCount),
    pointsPerDollar: String(artist.pointsPerDollar),
    referralPoints: String(artist.referralPoints),
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { pending, run } = useRunAction();
  const set = <K extends keyof typeof form>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const disabled = !canManage;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    run(
      () =>
        updateArtistAction({
          name: form.name.trim(),
          genre: form.genre.trim() || null,
          country: form.country.trim() || null,
          bio: form.bio.trim() || null,
          accentColor: form.accentColor,
          avatarUrl: form.avatarUrl.trim() || null,
          bannerUrl: form.bannerUrl.trim() || null,
          followerCount: intOr(form.followerCount, 0),
          settings: { pointsPerDollar: intOr(form.pointsPerDollar, 1), referralPoints: intOr(form.referralPoints, 200) },
        }),
      { success: "Settings saved", onError: (_e, fieldErrors) => setErrors(fieldErrors ?? {}) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!canManage ? <p className="rounded-xl bg-muted px-4 py-2.5 text-xs text-muted-foreground">Only admins and owners can change workspace settings.</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How your fan club appears on passports and the public artist page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <Avatar src={form.avatarUrl || null} name={form.name} size={64} rounded="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{form.name || "Your artist name"}</p>
              <p className="truncate text-xs text-muted-foreground">superfan.app/artists/{artist.slug}</p>
            </div>
          </div>
          <Field label="Name" htmlFor="ar-name" error={errors.name}>
            <Input id="ar-name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} disabled={disabled} />
          </Field>
          <Field label="URL slug" htmlFor="ar-slug" hint="Slugs are permanent so shared links keep working.">
            <Input id="ar-slug" value={artist.slug} readOnly disabled className="font-mono" />
          </Field>
          <Field label="Genre" htmlFor="ar-genre" error={errors.genre}>
            <Input id="ar-genre" value={form.genre} onChange={(e) => set("genre", e.target.value)} placeholder="Alt-pop" maxLength={60} disabled={disabled} />
          </Field>
          <Field label="Country" htmlFor="ar-country" error={errors.country}>
            <Input id="ar-country" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="US" maxLength={60} disabled={disabled} />
          </Field>
          <Field label="Bio" htmlFor="ar-bio" error={errors.bio} className="sm:col-span-2">
            <Textarea id="ar-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="A line or two for the passport." maxLength={600} disabled={disabled} className="min-h-20" />
          </Field>
          <Field label="Accent color" htmlFor="ar-accent" error={errors.accentColor} hint="Used for gradients and highlights on fan pages.">
            <div className="flex items-center gap-3">
              <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} disabled={disabled} className="size-10 cursor-pointer rounded-lg border border-input bg-transparent p-1 disabled:cursor-not-allowed" aria-label="Accent color" />
              <Input id="ar-accent" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} pattern="^#[0-9a-fA-F]{6}$" className="w-32 font-mono" disabled={disabled} />
              <span className="size-10 rounded-xl" style={{ background: `linear-gradient(135deg, ${form.accentColor}, color-mix(in oklab, ${form.accentColor} 55%, #f472b6))` }} aria-hidden />
            </div>
          </Field>
          <Field label="Follower count" htmlFor="ar-followers" error={errors.followerCount} hint="Shown on the public page.">
            <Input id="ar-followers" type="number" min={0} inputMode="numeric" value={form.followerCount} onChange={(e) => set("followerCount", e.target.value)} className="tabular" disabled={disabled} />
          </Field>
          <Field label="Avatar URL" htmlFor="ar-avatar" error={errors.avatarUrl}>
            <Input id="ar-avatar" type="url" value={form.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} placeholder="https://…" disabled={disabled} />
          </Field>
          <Field label="Banner URL" htmlFor="ar-banner" error={errors.bannerUrl}>
            <Input id="ar-banner" type="url" value={form.bannerUrl} onChange={(e) => set("bannerUrl", e.target.value)} placeholder="https://…" disabled={disabled} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reward Points</CardTitle>
          <CardDescription>How fans earn spendable points. Superfan Score rules live under Scoring.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Points per $1 spent" htmlFor="ar-ppd" hint="Applied to verified merch orders.">
            <Input id="ar-ppd" type="number" min={0} max={1000} inputMode="numeric" value={form.pointsPerDollar} onChange={(e) => set("pointsPerDollar", e.target.value)} className="tabular" disabled={disabled} />
          </Field>
          <Field label="Referral points" htmlFor="ar-ref" hint="Awarded to the referrer once a friend takes their first action.">
            <Input id="ar-ref" type="number" min={0} max={100000} inputMode="numeric" value={form.referralPoints} onChange={(e) => set("referralPoints", e.target.value)} className="tabular" disabled={disabled} />
          </Field>
        </CardContent>
      </Card>

      {canManage ? (
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      ) : null}
    </form>
  );
}
