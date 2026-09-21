"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/result";

type Options<T> = {
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  onError?: (error: string, fieldErrors?: Record<string, string>) => void;
  refresh?: boolean;
};

/**
 * Run a server action from a client component with pending state, toast
 * feedback and a router refresh on success.
 */
export function useRunAction() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = React.useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, opts: Options<T> = {}) =>
      start(async () => {
        const res = await action();
        if (!res.ok) {
          toast.error(res.error);
          opts.onError?.(res.error, res.fieldErrors);
          return;
        }
        if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res.data) : opts.success);
        opts.onSuccess?.(res.data);
        if (opts.refresh !== false) router.refresh();
      }),
    [router],
  );
  return { pending, run };
}
