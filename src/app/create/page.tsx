import { redirect } from "next/navigation";
import { StravaButton } from "@/components/strava-card";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getStravaFriends } from "@/lib/queries";
import { isStravaConfigured } from "@/lib/strava";
import type { Race } from "@/lib/types";
import { CreateBetForm } from "./create-bet-form";

export const metadata = { title: "Create a bet · PolyRunner" };

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/create");

  const { athlete } = await searchParams;
  const [friends, races, stravaEnabled, connected] = await Promise.all([
    getStravaFriends(),
    query<Race>("select * from races where starts_at > now() order by starts_at"),
    isStravaConfigured(),
    queryOne("select 1 from strava_accounts where user_id = $1", [profile.id]),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Create a bet</h1>
        <p className="text-sm text-muted-foreground">
          Open a market on a friend&apos;s next race. Everyone starts trading right away.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-5">
        {friends.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-sm">
            <p className="font-medium">No friends on Strava yet</p>
            <p className="max-w-sm text-muted-foreground">
              Bets can only be created on friends who connected Strava, so their finish time can be
              verified. Connect yours and invite your running buddies.
            </p>
            {stravaEnabled && !connected && (
              <StravaButton href="/api/strava/connect?next=/create">Connect with Strava</StravaButton>
            )}
          </div>
        ) : (
          <CreateBetForm friends={friends} races={races} initialAthleteId={athlete} />
        )}
      </section>
    </div>
  );
}
