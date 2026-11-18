import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { JoinRunnerButton } from "@/components/join-runner-button";
import { StravaCard } from "@/components/strava-card";
import { SubmitPbForm } from "@/components/submit-pb-form";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isStravaConfigured } from "@/lib/strava";
import { formatPace, formatTime } from "@/lib/time";
import type { ClaimStatus } from "@/lib/types";

export const metadata = { title: "Profile · PolyRunner" };

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/profile");

  const stravaEnabled = await isStravaConfigured();
  const [runner, pbs, pendingPbs, toSubmit, strava] = await Promise.all([
    queryOne<{ id: string; name: string }>(
      "select id, name from athletes where user_id = $1",
      [profile.id],
    ),
    query<{ distance_km: number; time_seconds: number }>(
      `select distance_km, time_seconds from athlete_pbs
        where athlete_id = (select id from athletes where user_id = $1)
        order by distance_km`,
      [profile.id],
    ),
    query<{ distance_km: number; time_seconds: number; status: ClaimStatus }>(
      `select distance_km, time_seconds, status from pb_claims
        where user_id = $1 and status = 'pending'
        order by created_at desc`,
      [profile.id],
    ),
    query<{ market_id: string; race_name: string; submitted: boolean }>(
      `select m.id as market_id, r.name as race_name,
              exists (select 1 from result_claims c
                       where c.market_id = m.id and c.user_id = $1 and c.status = 'pending') as submitted
         from markets m
         join races r on r.id = m.race_id
         join athletes a on a.id = m.athlete_id
        where a.user_id = $1 and m.kind = 'time' and m.status <> 'resolved' and r.starts_at <= now()
        order by r.starts_at desc`,
      [profile.id],
    ),
    stravaEnabled
      ? queryOne<{ display_name: string | null; athlete_name: string | null }>(
          `select coalesce(s.display_name, 'Strava athlete') as display_name,
                  (select a.name from athletes a where a.user_id = s.user_id) as athlete_name
             from strava_accounts s where s.user_id = $1`,
          [profile.id],
        )
      : null,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div className="flex items-center gap-4">
        <Avatar name={profile.username} url={profile.avatar_url} size={56} />
        <div>
          <h1 className="text-2xl font-semibold">{profile.username}</h1>
          <p className="text-sm text-muted-foreground">
            Your runner profile ·{" "}
            <Link href="/wallet" className="text-primary hover:underline">
              Wallet
            </Link>
            {" · "}
            <Link href="/friends" className="text-primary hover:underline">
              Friends
            </Link>
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            {runner ? (
              <>
                <p className="font-medium">You&apos;re listed as {runner.name}</p>
                <p className="text-muted-foreground">
                  Friends who accept your request can bet on your races. After each race, submit your
                  finish time with a proof.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Running in a race?</p>
                <p className="text-muted-foreground">
                  Join as a runner so friends can find you, bet on your finish times, and you can
                  publish verified personal bests.
                </p>
              </>
            )}
          </div>
          {!runner && <JoinRunnerButton />}
        </div>
        {toSubmit.map((m) => (
          <Link
            key={m.market_id}
            href={`/markets/${m.market_id}#submit-result`}
            className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 hover:bg-primary/15"
          >
            <span>
              <b>{m.race_name}</b>:{" "}
              {m.submitted ? "result submitted, waiting for an admin" : "submit your finish time"}
            </span>
            <span className="text-primary">{m.submitted ? "View" : "Submit"} →</span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-medium">Personal bests</h2>
          <p className="text-sm text-muted-foreground">
            Submit a PB with proof. After an admin verifies it, new finish-time markets on that
            distance open with odds peaked around your time, not flat.
          </p>
        </div>

        {pbs.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {pbs.map((p) => (
              <li key={p.distance_km} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{Number(p.distance_km)} km</span>
                <span className="font-medium">
                  {formatTime(p.time_seconds)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({formatPace(p.time_seconds, Number(p.distance_km))})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No verified personal bests yet.</p>
        )}

        {pendingPbs.map((p) => (
          <p
            key={`${p.distance_km}-${p.time_seconds}`}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
          >
            Pending: {Number(p.distance_km)} km in {formatTime(p.time_seconds)} — waiting for an
            admin.
          </p>
        ))}

        {runner ? (
          <SubmitPbForm />
        ) : (
          <p className="text-sm text-muted-foreground">Join as a runner to submit personal bests.</p>
        )}
      </section>

      <StravaCard
        connectedAs={strava?.display_name ?? null}
        athleteName={strava?.athlete_name ?? null}
        configured={stravaEnabled}
        isAdmin={profile.is_admin}
      />
    </div>
  );
}
