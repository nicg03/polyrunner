import { redirect } from "next/navigation";
import { ConnectDevicesClient } from "./client";
import { getCurrentProfile } from "@/lib/auth";
import { getConnectedProviders } from "@/lib/activity";
import { queryOne } from "@/lib/db";
import { FreshStartBanner } from "@/components/fresh-start-banner";

export const metadata = { title: "Dispositivi · PolyRunner" };

export default async function ConnectDevicesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/connect-devices");

  const [sources, prefs] = await Promise.all([
    getConnectedProviders(profile.id),
    queryOne<{ weekly_markets_opt_in: boolean }>(
      `select weekly_markets_opt_in from user_activity_prefs where user_id = $1`,
      [profile.id],
    ),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Dispositivi</h1>
        <p className="text-sm text-muted-foreground">
          Collega un tracker per mercati settimanali e Commitment Pot. Garmin è in stub; usa Demo
          per provare.
        </p>
      </div>
      <FreshStartBanner />
      <ConnectDevicesClient
        sources={sources}
        weeklyOptIn={Boolean(prefs?.weekly_markets_opt_in)}
      />
    </div>
  );
}
