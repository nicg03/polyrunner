"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, { ok?: string; error?: string }> = {
  connected: { ok: "Strava collegato" },
  welcome: {
    ok: "Benvenuto su PolyRunner! Hai ricevuto 1.000 crediti per iniziare a scommettere.",
  },
  welcome_back: { ok: "Bentornato!" },
  denied: { error: "Accesso a Strava non concesso" },
  scope: {
    error:
      "Consenti a PolyRunner di leggere le tue attività, così i risultati di gara possono essere verificati",
  },
  error: { error: "Qualcosa è andato storto con Strava, riprova" },
  unavailable: { error: "Strava non è ancora configurato. Chiedi all'admin." },
};

/** Shows the outcome of the Strava redirect (?strava=...) once, then cleans the URL. */
export function StravaStatusToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("strava");

  useEffect(() => {
    const message = status ? MESSAGES[status] : null;
    if (!message) return;
    if (message.ok) toast.success(message.ok);
    else toast.error(message.error);
    const rest = new URLSearchParams(params);
    rest.delete("strava");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [status, params, pathname, router]);

  return null;
}