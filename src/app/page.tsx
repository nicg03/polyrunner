import Link from "next/link";
import { MarketCard } from "@/components/market-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { SetupNotice } from "@/components/setup-notice";
import { cn } from "@/lib/utils";
import { getMarkets, getRaces, isUuid } from "@/lib/queries";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ race?: string; status?: string; type?: string }>;
}) {
  if (!isDatabaseConfigured) return <SetupNotice />;

  const { race, status = "open", type } = await searchParams;
  const [allMarkets, races] = await Promise.all([getMarkets({ raceId: race && isUuid(race) ? race : undefined }), getRaces()]);
  const markets = allMarkets.filter(
    (m) =>
      (status === "resolved" ? m.status === "resolved" : m.status !== "resolved") &&
      (!type || m.kind === type),
  );

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
      active
        ? "border-primary bg-primary/15 text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const href = (params: { race?: string; status?: string; type?: string }) => {
    const sp = new URLSearchParams();
    if (params.race) sp.set("race", params.race);
    if (params.status && params.status !== "open") sp.set("status", params.status);
    if (params.type) sp.set("type", params.type);
    const s = sp.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <AutoRefresh intervalMs={15000} />

      <section className="rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">How fast will they run?</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Bet virtual credits on your friends&apos; finish times and on anything else that
          might happen on race day. Odds move with every trade.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ status, type })} className={chip(!race)}>
          All races
        </Link>
        {races.map((r) => (
          <Link key={r.id} href={href({ race: r.id, status, type })} className={chip(race === r.id)}>
            {r.name}
          </Link>
        ))}
      </div>

      <div className="-mt-3 flex flex-wrap items-center gap-2">
        <Link href={href({ race, status })} className={chip(!type)}>
          All bets
        </Link>
        <Link href={href({ race, status, type: "time" })} className={chip(type === "time")}>
          Finish times
        </Link>
        <Link href={href({ race, status, type: "custom" })} className={chip(type === "custom")}>
          Yes / No
        </Link>
        <div className="ml-auto flex gap-2">
          <Link href={href({ race, type, status: "open" })} className={chip(status !== "resolved")}>
            Active
          </Link>
          <Link href={href({ race, type, status: "resolved" })} className={chip(status === "resolved")}>
            Resolved
          </Link>
        </div>
      </div>

      {markets.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No markets here yet.</p>
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
