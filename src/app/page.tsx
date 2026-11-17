import Link from "next/link";
import { MarketCard } from "@/components/market-card";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { SetupNotice } from "@/components/setup-notice";
import { cn } from "@/lib/utils";
import { getMarkets, getRaces } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ race?: string; status?: string }>;
}) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const { race, status = "open" } = await searchParams;
  const [allMarkets, races] = await Promise.all([getMarkets({ raceId: race }), getRaces()]);
  const markets = allMarkets.filter((m) =>
    status === "resolved" ? m.status === "resolved" : m.status !== "resolved",
  );

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
      active
        ? "border-primary bg-primary/15 text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const href = (params: { race?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params.race) sp.set("race", params.race);
    if (params.status && params.status !== "open") sp.set("status", params.status);
    const s = sp.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <RealtimeRefresher channel="home" subscriptions={[{ table: "markets" }]} />

      <section className="rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Quanto ci metterà?</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Punta crediti virtuali sulla fascia di tempo in cui pensi che i tuoi amici
          chiuderanno la gara. Le probabilità si muovono con le giocate di tutti.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ status })} className={chip(!race)}>
          Tutte le gare
        </Link>
        {races.map((r) => (
          <Link key={r.id} href={href({ race: r.id, status })} className={chip(race === r.id)}>
            {r.name}
          </Link>
        ))}
        <div className="ml-auto flex gap-2">
          <Link href={href({ race, status: "open" })} className={chip(status !== "resolved")}>
            Attivi
          </Link>
          <Link href={href({ race, status: "resolved" })} className={chip(status === "resolved")}>
            Risolti
          </Link>
        </div>
      </div>

      {markets.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Nessun mercato qui, per ora.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
