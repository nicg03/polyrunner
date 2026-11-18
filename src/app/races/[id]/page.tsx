import { notFound } from "next/navigation";
import { Calendar, MapPin, Ruler } from "lucide-react";
import { MarketCard } from "@/components/market-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { getMarkets, getRace, isUuid } from "@/lib/queries";
import { formatDateTime, formatVolume } from "@/lib/format";
import type { MarketWithRelations } from "@/lib/types";

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const race = await getRace(id);
  if (!race) notFound();

  const markets = await getMarkets({ raceId: id });
  const volume = markets.reduce((sum, m) => sum + Number(m.volume), 0);

  return (
    <div className="flex flex-col gap-6 py-6">
      <AutoRefresh intervalMs={15000} />
      <section className="rounded-2xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">{race.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4" /> {formatDateTime(race.starts_at)}
          </span>
          <span className="flex items-center gap-1.5">
            <Ruler className="size-4" /> {Number(race.distance_km)} km
          </span>
          {race.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {race.location}
            </span>
          )}
          <span>{formatVolume(volume)} credits total vol.</span>
        </div>
      </section>

      {markets.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">No markets in this race yet.</p>
      )}
      <MarketSection title="Finish times" markets={markets.filter((m) => m.kind === "time")} />
      <MarketSection title="Other bets" markets={markets.filter((m) => m.kind === "custom")} />
    </div>
  );
}

function MarketSection({ title, markets }: { title: string; markets: MarketWithRelations[] }) {
  if (markets.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </section>
  );
}
