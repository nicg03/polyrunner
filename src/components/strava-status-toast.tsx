"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, { ok?: string; error?: string }> = {
  connected: { ok: "Strava connected" },
  welcome: { ok: "Welcome to PolyRunner! You got 1,000 credits to start betting." },
  welcome_back: { ok: "Welcome back!" },
  denied: { error: "Strava access was not granted" },
  scope: { error: "Allow PolyRunner to read your activities, so your race results can be verified" },
  error: { error: "Something went wrong with Strava, please try again" },
  unavailable: { error: "Strava is not set up yet. Ask the admin." },
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
