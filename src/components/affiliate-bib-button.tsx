"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { trackAffiliateClick } from "@/actions/commerce";
import { Button } from "@/components/ui/button";

export function AffiliateBibButton({ raceId, hasUrl }: { raceId: string; hasUrl: boolean }) {
  const [pending, start] = useTransition();
  if (!hasUrl) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await trackAffiliateClick(raceId);
          if (!res.url) {
            toast.error("Link affiliazione non disponibile");
            return;
          }
          window.open(res.url, "_blank", "noopener,noreferrer");
        })
      }
    >
      Acquista pettorale (affiliazione)
    </Button>
  );
}
