import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { CommunityMock } from "@/components/marketing/community-mock";
import { DashboardMock } from "@/components/marketing/dashboard-mock";
import { FragmentsMock } from "@/components/marketing/fragments-mock";
import { PassportMock } from "@/components/marketing/passport-mock";
import { ProfileMock } from "@/components/marketing/profile-mock";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Superfan · Know your real fans" };

function Section({ id, eyebrow, title, description, children, className }: { id?: string; eyebrow: string; title: string; description: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-artist">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          <p className="mt-4 text-base text-muted-foreground text-balance sm:text-lg">{description}</p>
        </div>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <SiteNav signedIn={Boolean(user)} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(139,92,246,0.16),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="size-3.5 text-artist" /> Fan identity, intelligence and rewards for artists
            </span>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
              Know your <span className="gradient-text">real fans.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance sm:text-xl">
              Superfan brings purchases, attendance, community and engagement together so artists can recognize and reward the people who care most.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/login">
                  Start building your fanbase <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href="#how">See how it works</a>
              </Button>
            </div>
          </div>
          <div className="mt-14 animate-rise sm:mt-20">
            <DashboardMock />
          </div>
        </div>
      </section>

      <Section id="how" eyebrow="The problem" title="Your audience is fragmented." description="Followers live on Instagram, buyers on Shopify, ticket holders with promoters, and your most devoted fans in comment threads. Nobody has the full picture.">
        <FragmentsMock />
      </Section>

      <Section id="artists" eyebrow="Fan intelligence" title="Know who's actually showing up." description="Every fan gets one verified profile built from first-party sources. A Superfan Score weighs purchases, attendance, engagement, referrals and community, so hype never outranks loyalty." className="bg-card/60">
        <ProfileMock />
      </Section>

      <Section eyebrow="The passport" title="Reward fandom, not follower count." description="Fans receive a collectible passport that shows their level, score and progress. Reward Points are earned by showing up and spent on the things only real fans get.">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <PassportMock className="mx-auto w-full max-w-md" />
          <ul className="space-y-6">
            {[
              { title: "Superfan Level + Score", body: "Status you earn. It reflects verified purchases, attendance, engagement and advocacy, and cannot be bought." },
              { title: "Reward Points", body: "Spendable currency for early access, merch drops, meet & greets and experiences. Earned at shows, through challenges and referrals." },
              { title: "Badges and progress", body: "Collectible milestones like First Show, Merch Collector and Top Referrer, with rarity across the whole fanbase." },
            ].map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-artist/10 text-artist">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="text-base font-semibold tracking-tight">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section eyebrow="Community" title="Turn superfans into your strongest community." description="Launch challenges, drop rewards, run QR check-ins at shows and give your most engaged fans a reason to bring their friends." className="bg-card/60">
        <CommunityMock />
      </Section>

      {/* Principles */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card-surface flex gap-4 p-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-artist/10 text-artist">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">Recognition, not surveillance.</p>
              <p className="mt-1 text-sm text-muted-foreground">We help artists recognize the people already showing up for them.</p>
            </div>
          </div>
          <div className="card-surface flex gap-4 p-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-success-soft text-success">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">First-party by design.</p>
              <p className="mt-1 text-sm text-muted-foreground">Official APIs and first-party data only. No scraping. Fans consent and can export or delete their data at any time.</p>
            </div>
          </div>
        </div>

        <div className="artist-gradient mt-12 flex flex-col items-center gap-5 rounded-3xl px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Start with the fans you already have.</h2>
          <p className="max-w-xl text-white/70 text-balance">Connect Instagram and Shopify, import your ticket buyers, and watch your real fanbase take shape in minutes.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-black hover:bg-white/90">
              <Link href="/login">Start building your fanbase</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link href="/artists/luma-vale">See the demo passport</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
