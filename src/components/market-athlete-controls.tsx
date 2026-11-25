"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  approveMarket,
  closeOwnMarket,
  hideOwnMarket,
  rejectMarket,
  unhideOwnMarket,
} from "@/actions/markets";
import { Button } from "@/components/ui/button";

export function MarketAthleteControls({
  marketId,
  approvalStatus,
  hidden,
  canManage,
}: {
  marketId: string;
  approvalStatus: string;
  hidden: boolean;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  if (!canManage) return null;

  function run(fn: () => Promise<{ ok?: string; error?: string } | null>) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (res?.ok) toast.success(res.ok);
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="mb-2 text-sm font-medium">Controlli runner</p>
      <div className="flex flex-wrap gap-2">
        {approvalStatus === "pending" && (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => approveMarket(marketId))}>
              Approva mercato
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => rejectMarket(marketId))}
            >
              Rifiuta
            </Button>
          </>
        )}
        {!hidden ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => hideOwnMarket(marketId))}
          >
            Nascondi
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => unhideOwnMarket(marketId))}
          >
            Mostra di nuovo
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => closeOwnMarket(marketId))}
        >
          Chiudi mercato
        </Button>
      </div>
    </div>
  );
}
