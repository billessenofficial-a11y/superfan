"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { claimIdentityAction } from "@/lib/actions/fan";

export function ClaimButton({ token, fallbackSlug }: { token: string; fallbackSlug: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="artist"
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await claimIdentityAction({ token });
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            toast.success("Activity claimed", { description: res.data.merged ? "Your history has been merged into your passport." : "Your account is now linked to your passport." });
            router.push(`/fan/${res.data.slug ?? fallbackSlug}`);
            router.refresh();
          })
        }
      >
        {pending ? null : <Check />}
        Yes, that&apos;s me
      </Button>
      <Link href="/fan" className="text-center text-xs text-muted-foreground hover:text-foreground">
        Not me
      </Link>
    </div>
  );
}
