"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, LogOut, Menu, Plus, Search, UserRound } from "lucide-react";
import { switchArtist } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarNav } from "./sidebar";
import { DemoMenu } from "./demo-menu";
import { FanSearch } from "./fan-search";

export type ShellProps = {
  artist: { id: string; name: string; slug: string; avatarUrl: string | null };
  memberships: { artistId: string; role: string; artist: { id: string; name: string; slug: string; avatarUrl: string | null } }[];
  user: { email: string; displayName: string | null; avatarUrl: string | null };
  role: string;
  demoMode: boolean;
};

export function ArtistSwitcher({ artist, memberships, compact = false }: Pick<ShellProps, "artist" | "memberships"> & { compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <Avatar src={artist.avatarUrl} name={artist.name} size={compact ? 26 : 30} rounded="xl" />
        {!compact ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold tracking-tight">{artist.name}</span>
            <span className="block truncate text-[11px] text-subtle">/artists/{artist.slug}</span>
          </span>
        ) : null}
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem key={m.artistId} onSelect={() => void switchArtist(m.artistId)}>
            <Avatar src={m.artist.avatarUrl} name={m.artist.name} size={22} rounded="xl" />
            <span className="flex-1 truncate">{m.artist.name}</span>
            {m.artistId === artist.id ? <Check className="size-4 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus /> New artist workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ user, role }: Pick<ShellProps, "user" | "role">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <Avatar src={user.avatarUrl} name={user.displayName ?? user.email} size={32} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium">{user.displayName ?? user.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.email} · <span className="capitalize">{role}</span>
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/fan">
            <UserRound /> My fan passport
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/auth/signout">
            <LogOut /> Sign out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileTopbar(props: ShellProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 glass lg:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Menu className="size-5" />
          <span className="sr-only">Open navigation</span>
        </DialogTrigger>
        <SheetContent side="left" className="p-4">
          <div className="mb-4 pr-8">
            <ArtistSwitcher artist={props.artist} memberships={props.memberships} />
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
          {props.demoMode ? (
            <div className="mt-6">
              <DemoMenu />
            </div>
          ) : null}
        </SheetContent>
      </Dialog>
      <div className="flex-1">
        <ArtistSwitcher artist={props.artist} memberships={props.memberships} compact />
      </div>
      <FanSearch trigger={<span className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Search className="size-5" /></span>} />
      <UserMenu user={props.user} role={props.role} />
    </header>
  );
}
