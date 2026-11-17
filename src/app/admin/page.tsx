import { redirect } from "next/navigation";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
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
          Solo gli admin possono gestire gare e mercati. Per diventare admin esegui nel SQL
          editor di Supabase:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {`update profiles set is_admin = true where username = '${profile.username}';`}
        </pre>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: races }, { data: athletes }, { data: markets }] = await Promise.all([
    supabase.from("races").select("*").order("starts_at", { ascending: false }),
    supabase.from("athletes").select("*").order("name"),
    supabase
      .from("markets")
      .select("id, status, race:races(name), athlete:athletes(name)")
      .neq("status", "resolved")
      .order("closes_at"),
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
          <MarketForm races={(races ?? []) as Race[]} athletes={(athletes ?? []) as Athlete[]} />
        </Panel>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Mercati da risolvere</h2>
          <p className="text-xs text-muted-foreground">
            Inserisci il tempo ufficiale (mm:ss o h:mm:ss): la fascia vincente paga 1 credito per quota.
          </p>
        </div>
        {(markets ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nessun mercato aperto.</p>
        ) : (
          ((markets ?? []) as unknown as AdminMarket[]).map((m) => (
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
