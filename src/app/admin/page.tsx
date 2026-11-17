import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { AthleteForm, MarketAdminRow, MarketForm, RaceForm } from "./forms";
import type { Athlete, Race } from "@/lib/types";

export const metadata = { title: "Admin · PolyRunner" };

interface AdminMarket {
  id: string;
  status: string;
  race: { name: string } | null;
  athlete: { name: string } | null;
}

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");

  if (!profile.is_admin) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-xl border bg-card p-6 text-sm">
        <h1 className="mb-2 text-lg font-semibold">Area riservata</h1>
        <p className="text-muted-foreground">
          Solo gli admin possono gestire gare e mercati. Il primo utente registrato è admin;
          per promuoverne altri esegui sul database:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {`update users set is_admin = true where username = '${profile.username}';`}
        </pre>
      </div>
    );
  }

  const [races, athletes, markets] = await Promise.all([
    query<Race>("select * from races order by starts_at desc"),
    query<Athlete>("select * from athletes order by name"),
    query<AdminMarket>(
      `select m.id, m.status,
              jsonb_build_object('name', r.name) as race,
              jsonb_build_object('name', a.name) as athlete
         from markets m
         join races r on r.id = m.race_id
         join athletes a on a.id = m.athlete_id
        where m.status <> 'resolved'
        order by m.closes_at`,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Nuova gara">
          <RaceForm />
        </Panel>
        <Panel title="Nuovo atleta">
          <AthleteForm />
        </Panel>
        <Panel title="Nuovo mercato">
          <MarketForm races={races} athletes={athletes} />
        </Panel>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Mercati da risolvere</h2>
          <p className="text-xs text-muted-foreground">
            Inserisci il tempo ufficiale (mm:ss o h:mm:ss): la fascia vincente paga 1 credito per quota.
          </p>
        </div>
        {markets.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun mercato aperto.</p>
        ) : (
          markets.map((m) => (
            <MarketAdminRow
              key={m.id}
              marketId={m.id}
              status={m.status}
              title={m.athlete?.name ?? "?"}
              subtitle={m.race?.name ?? ""}
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
