"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/result";

type Props<T> = Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
  successMessage?: string | ((data: T) => string);
  confirm?: string;
  refresh?: boolean;
};

/**
 * Button that runs a server action with pending state, toast feedback and
 * optional confirmation. Keeps the page components tiny.
 */
export function ActionButton<T>({ action, onSuccess, successMessage, confirm, refresh = true, children, ...rest }: Props<T>) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      {...rest}
      loading={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          if (successMessage) toast.success(typeof successMessage === "function" ? successMessage(res.data) : successMessage);
          onSuccess?.(res.data);
          if (refresh) router.refresh();
        });
      }}
    >
      {children}
    </Button>
  );
}
