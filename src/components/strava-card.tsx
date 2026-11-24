"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { disconnectStrava, refreshWeeklyKm } from "@/actions/strava";
import { Button } from "@/components/ui/button";

export function StravaCard({
  connectedAs,
  athleteName,
  configured = true,
  isAdmin = false,
  weeklyKm = null,
}: {
  connectedAs: string | null;
  athleteName: string | null;
  configured?: boolean;
  isAdmin?: boolean;
  weeklyKm?: { km: number; credits: number } | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
      <StravaLogo />
      <div className="min-w-0 flex-1 text-sm">
        {connectedAs ? (
          <>
            <p className="font-medium">Connected to Strava as {connectedAs}</p>
            <p className="text-muted-foreground">
              {athleteName
                ? "Your race-day runs are picked up automatically, no need to submit them by hand."
                : "An admin still needs to link you to your athlete profile."}{" "}
              Weekly km earn virtual credits (linear to 40 km, then a lower rate). Credits unlock
              Premium and are not cash.
            </p>
            {weeklyKm && (
              <p className="mt-1 text-xs">
                This week: <b>{weeklyKm.km} km</b> → {weeklyKm.credits.toFixed(0)} credits awarded
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-medium">Strava (optional)</p>
            <p className="text-muted-foreground">
              {configured
                ? "Connect Strava and your race-day runs are found automatically. Weekly kilometres also earn credits toward Premium."
                : isAdmin
                  ? "Strava is not configured yet: add your Strava API Client ID and Secret in the Admin page."
                  : "Strava has not been set up by an admin yet."}
            </p>
          </>
        )}
      </div>
      {connectedAs ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await refreshWeeklyKm();
                if (res?.error) toast.error(res.error);
                else if (res?.ok) toast.success(res.ok);
              })
            }
          >
            Sync weekly km
          </Button>
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
        </div>
      ) : configured ? (
        <StravaButton href="/api/strava/connect?next=/profile">Connect with Strava</StravaButton>
      ) : isAdmin ? (
        <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
          Set up Strava in Admin
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Not available yet</span>
      )}
    </section>
  );
}

export function StravaButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#fc5200] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#e34a00] ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" className="size-4 fill-white" aria-hidden>
        <path d={STRAVA_PATH} />
      </svg>
      {children}
    </a>
  );
}

const STRAVA_PATH =
  "M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169";

function StravaLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-8 shrink-0 fill-[#fc5200]" aria-label="Strava">
      <path d={STRAVA_PATH} />
    </svg>
  );
}
