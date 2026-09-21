"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; kind: ToastKind; title: string; description?: string; href?: string };

type Listener = (items: ToastItem[]) => void;
let items: ToastItem[] = [];
let listeners: Listener[] = [];
let counter = 0;

function emit() {
  for (const l of listeners) l(items);
}

function push(kind: ToastKind, title: string, opts: { description?: string; href?: string; duration?: number } = {}) {
  const id = ++counter;
  items = [...items, { id, kind, title, description: opts.description, href: opts.href }];
  emit();
  setTimeout(() => dismiss(id), opts.duration ?? 4500);
  return id;
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/** Lightweight toast API: toast.success("Saved"), toast.error("Nope", { description }). */
export const toast = {
  success: (title: string, opts?: { description?: string; href?: string; duration?: number }) => push("success", title, opts),
  error: (title: string, opts?: { description?: string; href?: string; duration?: number }) => push("error", title, opts),
  info: (title: string, opts?: { description?: string; href?: string; duration?: number }) => push("info", title, opts),
  warning: (title: string, opts?: { description?: string; href?: string; duration?: number }) => push("warning", title, opts),
  dismiss,
};

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-success" />,
  error: <XCircle className="size-4 text-danger" />,
  info: <Info className="size-4 text-info" />,
  warning: <TriangleAlert className="size-4 text-warning" />,
};

function subscribe(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
const getSnapshot = () => items;
const getServerSnapshot = (): ToastItem[] => EMPTY;
const EMPTY: ToastItem[] = [];

export function Toaster() {
  const list = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (list.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-popover/95 p-3.5 pr-10 text-popover-foreground shadow-2xl glass animate-rise relative")}
          role="status"
        >
          <span className="mt-0.5">{ICONS[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-5">{t.title}</p>
            {t.description ? <p className="mt-0.5 text-xs text-muted-foreground leading-4">{t.description}</p> : null}
            {t.href ? (
              <a href={t.href} className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
                View →
              </a>
            ) : null}
          </div>
          <button onClick={() => dismiss(t.id)} className="absolute right-2.5 top-2.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
