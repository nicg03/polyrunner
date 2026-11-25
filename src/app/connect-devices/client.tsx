"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  connectActivityProvider,
  disconnectActivityProvider,
  setWeeklyMarketsOptIn,
  syncActivityWeek,
} from "@/actions/activity";
import { Button } from "@/components/ui/button";

export function ConnectDevicesClient({
  sources,
  weeklyOptIn,
}: {
  sources: { provider: string; status: string; last_sync_at: string | null }[];
  weeklyOptIn: boolean;
}) {
  const [pending, start] = useTransition();
  const byId = Object.fromEntries(sources.map((s) => [s.provider, s]));

  function run(fn: () => Promise<{ ok?: string; error?: string } | null>) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (res?.ok) toast.success(res.ok);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {[
        { id: "mock", label: "Demo (simulato)" },
        { id: "garmin", label: "Garmin (prossimamente)" },
      ].map((p) => {
        const s = byId[p.id];
        const connected = s?.status === "connected";
        return (
          <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
            <div>
              <p className="font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">
                {connected
                  ? `Collegato${s.last_sync_at ? ` · sync ${new Date(s.last_sync_at).toLocaleString("it-IT")}` : ""}`
                  : "Non collegato"}
              </p>
            </div>
            {connected ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => disconnectActivityProvider(p.id))}
              >
                Scollega
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => connectActivityProvider(p.id))}
              >
                Collega
              </Button>
            )}
          </div>
        );
      })}

      <Button disabled={pending} onClick={() => run(() => syncActivityWeek())}>
        Sincronizza settimana
      </Button>

      <label className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm">
        <input
          type="checkbox"
          checked={weeklyOptIn}
          disabled={pending}
          onChange={(e) => run(() => setWeeklyMarketsOptIn(e.target.checked))}
        />
        Attiva mercati settimanali automatici su di me
      </label>
    </div>
  );
}
