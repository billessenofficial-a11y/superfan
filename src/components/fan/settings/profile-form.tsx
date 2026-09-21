"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { updateFanProfileAction } from "@/lib/actions/fan";

type Profile = { firstName: string | null; lastName: string | null; city: string | null; country: string | null; email: string | null; communicationPreferences: { email: boolean; sms: boolean } };

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    email: profile.communicationPreferences.email,
    sms: profile.communicationPreferences.sms,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateFanProfileAction({
        firstName: form.firstName,
        lastName: form.lastName,
        city: form.city,
        country: form.country,
        communicationPreferences: { email: form.email, sms: form.sms },
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      toast.success("Profile saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="card-surface p-5">
      <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
      <p className="text-xs text-muted-foreground">Shown on your passport and to artists whose clubs you join.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.firstName} htmlFor="firstName">
          <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
        </Field>
        <Field label="Last name" error={errors.lastName} htmlFor="lastName">
          <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
        </Field>
        <Field label="City" error={errors.city} htmlFor="city" hint="Used for local-only rewards.">
          <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" />
        </Field>
        <Field label="Country" error={errors.country} htmlFor="country">
          <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} autoComplete="country-name" />
        </Field>
        <Field label="Email" className="col-span-2" hint="Verified sign-in email. Contact support to change it.">
          <Input value={profile.email ?? ""} disabled />
        </Field>
      </div>

      <h3 className="mt-6 text-sm font-semibold tracking-tight">Communication</h3>
      <div className="mt-3 divide-y divide-border rounded-xl bg-muted/60">
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Email updates</p>
            <p className="text-xs text-muted-foreground">Rewards drops, challenges and show reminders from artists you follow.</p>
          </div>
          <Switch checked={form.email} onCheckedChange={(v) => setForm({ ...form, email: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium">SMS</p>
            <p className="text-xs text-muted-foreground">Day-of-show texts. Only when a phone number is verified.</p>
          </div>
          <Switch checked={form.sms} onCheckedChange={(v) => setForm({ ...form, sms: v })} />
        </label>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" variant="artist" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
