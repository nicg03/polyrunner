import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { headers } from "next/headers";
import { appOrigin, getStravaSetupStatus } from "@/lib/strava";
import { StravaSetup } from "./strava-setup";
import {
  AthleteForm,
  CustomMarketForm,
  MarketAdminRow,
  MarketForm,
  RaceForm,
  StravaLinkRow,
  type StravaUser,
} from "./forms";
import type { Athlete, MarketKind, Race, ResultClaim, StravaResult } from "@/lib/types";

export const metadata = { title: "Admin · PolyRunner" };

interface AdminMarket {
  id: string;
  status: string;
  kind: MarketKind;
  title: string;
  race_name: string;
  outcomes: { id: string; label: string }[];
  strava_linked: boolean;
  strava_results: StravaResult[];
  claims: ResultClaim[];
}

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");

  if (!profile.is_admin) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-xl border bg-card p-6 text-sm">
        <h1 className="mb-2 text-lg font-semibold">Admins only</h1>
        <p className="text-muted-foreground">
          Only admins can manage races and markets. The first user to sign up is the admin; to
          promote someone else, run on the database:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {`update users set is_admin = true where username = '${profile.username}';`}
        </pre>
      </div>
    );
  }

  const origin = appOrigin(await headers());
  const stravaStatus = await getStravaSetupStatus();
  const isStravaConfigured = stravaStatus.source !== null;

  const [races, athletes, markets, stravaUsers] = await Promise.all([
    query<Race>("select * from races order by starts_at desc"),
    query<Athlete & { user_id: string | null }>("select * from athletes order by name"),
    query<AdminMarket>(
      `select m.id, m.status, m.kind, r.name as race_name,
              case when m.kind = 'custom' then m.question else 'Finish time: ' || a.name end as title,
              (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.sort_order)
                 from outcomes o where o.market_id = m.id) as outcomes,
              exists (select 1 from strava_accounts s where s.user_id = a.user_id) as strava_linked,
              (select coalesce(jsonb_agg(sr order by sr.created_at), '[]'::jsonb)
                 from strava_results sr
                where sr.market_id = m.id and sr.status = 'pending') as strava_results,
              (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', c.id, 'market_id', c.market_id, 'username', u.username,
                        'time_seconds', c.time_seconds, 'evidence_kind', c.evidence_kind,
                        'evidence_url', c.evidence_url, 'note', c.note, 'status', c.status,
                        'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
                 from result_claims c join users u on u.id = c.user_id
                where c.market_id = m.id and c.status = 'pending') as claims
         from markets m
         join races r on r.id = m.race_id
         left join athletes a on a.id = m.athlete_id
        where m.status <> 'resolved'
        order by m.closes_at, m.kind desc`,
    ),
    isStravaConfigured
      ? query<StravaUser>(
          `select u.id, u.username, s.display_name
             from strava_accounts s join users u on u.id = s.user_id
            order by u.username`,
        )
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <Panel title="Strava setup">
        <StravaSetup status={stravaStatus} origin={origin} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="New race">
          <RaceForm />
        </Panel>
        <Panel title="New athlete">
          <AthleteForm />
        </Panel>
        <Panel title="New finish-time market">
          <MarketForm races={races} athletes={athletes} />
        </Panel>
        <Panel title="New Yes/No market">
          <CustomMarketForm races={races} athletes={athletes} />
        </Panel>
      </div>

      {isStravaConfigured && (
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Strava links</h2>
            <p className="text-xs text-muted-foreground">
              Link each athlete to the user who runs as them. Their race-day Strava activities then
              show up below as results to confirm.
            </p>
          </div>
          {athletes.map((a) => (
            <StravaLinkRow key={a.id} athlete={a} users={stravaUsers} />
          ))}
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Markets to resolve</h2>
          <p className="text-xs text-muted-foreground">
            Finish-time markets: check the submitted results and their proof, or enter the official
            time (mm:ss or h:mm:ss). Yes/No markets: pick the outcome. Winning shares pay 1 credit
            each.
          </p>
        </div>
        {markets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No open markets.</p>
        ) : (
          markets.map((m) => (
            <MarketAdminRow
              key={m.id}
              marketId={m.id}
              status={m.status}
              kind={m.kind}
              title={m.title}
              subtitle={m.race_name}
              outcomes={m.outcomes}
              stravaLinked={isStravaConfigured && m.strava_linked}
              stravaResults={m.strava_results}
              claims={m.claims}
            />
          ))
        )}
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}
