"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { disconnectStrava } from "@/actions/strava";
import { Button } from "@/components/ui/button";

const STATUS_MESSAGES: Record<string, { ok?: string; error?: string }> = {
  connected: { ok: "Strava connected" },
  denied: { error: "Strava access was not granted" },
  scope: { error: "Allow PolyRunner to read your activities to verify race results" },
  error: { error: "Could not connect Strava, try again" },
  unavailable: { error: "Strava is not configured on this server" },
};

export function StravaCard({
  connectedAs,
  athleteName,
}: {
  connectedAs: string | null;
  athleteName: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = params.get("strava");
  useEffect(() => {
    const message = status ? STATUS_MESSAGES[status] : null;
    if (!message) return;
    if (message.ok) toast.success(message.ok);
    else toast.error(message.error);
    router.replace("/portfolio", { scroll: false });
  }, [status, router]);

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
      <StravaLogo />
      <div className="min-w-0 flex-1 text-sm">
        {connectedAs ? (
          <>
            <p className="font-medium">Connected to Strava as {connectedAs}</p>
            <p className="text-muted-foreground">
              {athleteName
                ? `Your race-day runs are used to verify ${athleteName}'s finish-time markets.`
                : "An admin still needs to link you to your athlete profile."}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Running in a race?</p>
            <p className="text-muted-foreground">
              Connect Strava so your finish time can settle bets on you automatically.
            </p>
          </>
        )}
      </div>
      {connectedAs ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await disconnectStrava();
              if (res?.error) toast.error(res.error);
              else if (res?.ok) toast.success(res.ok);
            })
          }
        >
          Disconnect
        </Button>
      ) : (
        <a
          href="/api/strava/connect"
          className="inline-flex h-9 items-center rounded-lg bg-[#fc5200] px-4 text-sm font-semibold text-white hover:bg-[#e34a00]"
        >
          Connect with Strava
        </a>
      )}
    </section>
  );
}

function StravaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-8 shrink-0 fill-[#fc5200]" aria-label="Strava">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
