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
            <p className="font-medium">Collegato a Strava come {connectedAs}</p>
            <p className="text-muted-foreground">
              {athleteName
                ? "Le tue corse del giorno gara vengono rilevate in automatico, senza invio manuale."
                : "Un admin deve ancora collegarti al tuo profilo atleta."}{" "}
              I km settimanali fanno guadagnare crediti virtuali (lineari fino a 40 km, poi a
              ritmo ridotto). I crediti sbloccano Premium e non sono denaro.
            </p>
            {weeklyKm && (
              <p className="mt-1 text-xs">
                Questa settimana: <b>{weeklyKm.km} km</b> → {weeklyKm.credits.toFixed(0)} crediti
                assegnati
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-medium">Strava (opzionale)</p>
            <p className="text-muted-foreground">
              {configured
                ? "Collega Strava: le corse del giorno gara si trovano da sole. I chilometri settimanali fanno guadagnare crediti verso Premium."
                : isAdmin
                  ? "Strava non è ancora configurato: aggiungi Client ID e Secret dell’API Strava nella pagina Admin."
                  : "Strava non è ancora stato configurato da un admin."}
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
            Sincronizza km settimanali
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
            Disconnetti
          </Button>
        </div>
      ) : configured ? (
        <StravaButton href="/api/strava/connect?next=/profile">Collega con Strava</StravaButton>
      ) : isAdmin ? (
        <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
          Configura Strava in Admin
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Non ancora disponibile</span>
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
