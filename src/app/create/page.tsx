import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { JoinRunnerButton } from "@/components/join-runner-button";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { getFriends } from "@/lib/queries";
import type { Race } from "@/lib/types";
import { CreateBetForm } from "./create-bet-form";

export const metadata = { title: "Crea scommessa · PolyRunner" };

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/create");

  const { athlete } = await searchParams;
  const [allFriends, races, pbRows] = await Promise.all([
    getFriends(profile.id),
    query<Race>("select * from races where starts_at > now() order by starts_at"),
    query<{ athlete_id: string; distance_km: number; time_seconds: number }>(
      `select athlete_id, distance_km, time_seconds from athlete_pbs
        where athlete_id in (select id from athletes where user_id = $1
          or id in (
            select a.id from athletes a
              join friendships f on f.status = 'accepted'
               and ((f.user_low = $1 and f.user_high = a.user_id)
                 or (f.user_high = $1 and f.user_low = a.user_id))
          ))`,
      [profile.id],
    ),
  ]);
  const me = allFriends.find((f) => f.user_id === profile.id) ?? null;
  const friends = allFriends.filter((f) => f.user_id !== profile.id);
  const pbs: Record<string, { distance_km: number; time_seconds: number }[]> = {};
  for (const row of pbRows) {
    (pbs[row.athlete_id] ??= []).push(row);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Crea una scommessa</h1>
        <p className="text-sm text-muted-foreground">
          Apri un mercato sulla tua gara o su quella di un amico.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-5">
        {!me && friends.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-sm">
            <p className="font-medium">Niente su cui scommettere ancora</p>
            <p className="max-w-sm text-muted-foreground">
              Diventa runner per scommettere su di te, oppure trova amici e attendi che accettino.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <JoinRunnerButton />
              <Link href="/friends" className={buttonVariants({ variant: "outline" })}>
                <UserPlus /> Trova amici
              </Link>
            </div>
          </div>
        ) : (
          <CreateBetForm
            me={me}
            friends={friends}
            races={races}
            initialAthleteId={athlete}
            pbs={pbs}
          />
        )}
      </section>
    </div>
  );
}
