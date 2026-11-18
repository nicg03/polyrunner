import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
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
  const [friends, races] = await Promise.all([
    getStravaFriends(),
    query<Race>("select * from races where starts_at > now() order by starts_at"),
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
            {isStravaConfigured && (
              <Link
                href="/portfolio"
                className="rounded-lg bg-[#fc5200] px-4 py-2 font-semibold text-white hover:bg-[#e34a00]"
              >
                Connect Strava
              </Link>
            )}
          </div>
        ) : (
          <CreateBetForm friends={friends} races={races} initialAthleteId={athlete} />
        )}
      </section>
    </div>
  );
}
