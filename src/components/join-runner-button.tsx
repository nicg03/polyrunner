"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { joinAsRunner } from "@/actions/results";
import { Button } from "@/components/ui/button";

export function JoinRunnerButton({ variant }: { variant?: "default" | "outline" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await joinAsRunner();
          if (res?.error) toast.error(res.error);
          else if (res?.ok) toast.success(res.ok);
        })
      }
    >
      {pending ? "Registrazione..." : "Entra come runner"}
    </Button>
  );
}
