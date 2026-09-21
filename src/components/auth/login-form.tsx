"use client";

import * as React from "react";
import { ArrowRight, Mail, Sparkles } from "lucide-react";
import { demoSignIn, requestMagicLink } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

type Props = {
  mode: "artist" | "fan";
  next?: string;
  artistName?: string;
  demo?: { enabled: boolean; artistEmail: string; fanEmail: string };
};

export function LoginForm({ mode, next, artistName, demo }: Props) {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState<{ email: string; devLink?: string } | null>(null);
  const [pending, start] = React.useTransition();
  const [demoPending, startDemo] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await requestMagicLink({ email, next, artistName });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSent({ email, devLink: res.data.devLink });
    });
  };

  if (sent) {
    return (
      <div className="animate-rise">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Mail className="size-6" />
        </div>
        <h2 className="text-center text-xl font-semibold tracking-tight">Check your email</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{sent.email}</span>. It expires in 15 minutes.
        </p>
        {sent.devLink ? (
          <div className="mt-6 rounded-xl border border-dashed border-warning/40 bg-warning-soft p-3 text-xs">
            <p className="font-medium text-warning">Development mode</p>
            <p className="mt-1 text-muted-foreground">Email is not configured, so here is your link:</p>
            <a href={sent.devLink} className="mt-2 inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4">
              Open sign-in link <ArrowRight className="size-3" />
            </a>
          </div>
        ) : null}
        <button className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setSent(null)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" autoComplete="email" />
        <Button type="submit" size="lg" loading={pending} className="w-full" variant={mode === "fan" ? "artist" : "default"}>
          Continue with email
        </Button>
      </form>
      <p className="mt-3 text-center text-xs text-subtle">No password needed. We&apos;ll email you a magic link.</p>

      {demo?.enabled ? (
        <div className="mt-8 rounded-2xl border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" /> Demo accounts
          </div>
          <div className="mt-3 grid gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={demoPending}
              onClick={() => startDemo(async () => void (await demoSignIn({ email: demo.artistEmail, next: mode === "fan" && next ? next : "/app" })))}
            >
              Artist dashboard · Luma Vale
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={demoPending}
              onClick={() => startDemo(async () => void (await demoSignIn({ email: demo.fanEmail, next: next && next !== "/app" ? next : "/fan/luma-vale" })))}
            >
              Fan passport · James Rellera
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
