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

export const metadata = { title: "Profilo · PolyRunner" };

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
            Il tuo profilo runner ·{" "}
            <Link href="/wallet" className="text-primary hover:underline">
              Wallet
            </Link>
            {" · "}
            <Link href="/premium" className="text-primary hover:underline">
              Premium
            </Link>
            {" · "}
            <Link href="/races?bib=1" className="text-primary hover:underline">
              Gare con PB
            </Link>
            {" · "}
            <Link href="/friends" className="text-primary hover:underline">
              Amici
            </Link>
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            {runner ? (
              <>
                <p className="font-medium">Sei in elenco come {runner.name}</p>
                <p className="text-muted-foreground">
                  Gli amici che accettano la richiesta possono scommettere sulle tue gare. Dopo ogni
                  gara, invia il tempo di arrivo con una prova.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Corri una gara?</p>
                <p className="text-muted-foreground">
                  Entra come runner così gli amici possono trovarti, scommettere sui tuoi tempi e
                  pubblicare personal best verificati.
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
              {m.submitted
                ? "risultato inviato, in attesa di verifica"
                : "invia il tuo tempo di arrivo"}
            </span>
            <span className="text-primary">{m.submitted ? "Vedi" : "Invia"} →</span>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-amber-500/20 bg-amber-400/5 p-4 text-sm">
        <p className="font-medium">Punta a un PB con rimborso pettorale</p>
        <p className="mt-1 text-muted-foreground">
          Sblocca{" "}
          <Link href="/premium" className="text-primary hover:underline">
            Premium
          </Link>
          , registra un pettorale su una gara in programma, poi batti il tuo PB — PolyRunner
          rimborsa la quota in automatico.{" "}
          <Link href="/races?bib=1" className="font-medium text-primary hover:underline">
            Cerca gare →
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-medium">Personal best</h2>
          <p className="text-sm text-muted-foreground">
            Invia un PB con prova per il profilo. I PB del giorno gara (dopo la risoluzione del
            mercato) attivano anche il rimborso pettorale Premium se hai registrato il pettorale.
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
          <p className="text-sm text-muted-foreground">Ancora nessun personal best verificato.</p>
        )}

        {pendingPbs.map((p) => (
          <p
            key={`${p.distance_km}-${p.time_seconds}`}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm"
          >
            In attesa: {Number(p.distance_km)} km in {formatTime(p.time_seconds)} — verifica in corso.
          </p>
        ))}

        {runner ? (
          <SubmitPbForm />
        ) : (
          <p className="text-sm text-muted-foreground">
            Entra come runner per inviare personal best.
          </p>
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