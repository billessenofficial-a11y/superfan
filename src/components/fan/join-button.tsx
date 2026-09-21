"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JoinSubmitButton({ artistName }: { artistName: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="artist" size="lg" loading={pending} className="w-full">
      Join {artistName}&apos;s Fan Club {pending ? null : <ArrowRight />}
    </Button>
  );
}
