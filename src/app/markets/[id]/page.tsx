import { notFound } from "next/navigation";
import { MarketView, type ActivityItem } from "@/components/market-view";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { getMarket } from "@/lib/queries";
import { outcomePrices } from "@/lib/lmsr";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { PriceSnapshot } from "@/lib/types";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);
  if (!market) notFound();

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: snapshots }, { data: trades }, { data: myPositions }] = await Promise.all([
    supabase
      .from("price_snapshots")
      .select("outcome_id, price, created_at")
      .eq("market_id", id)
      .order("created_at")
      .limit(5000),
    supabase
      .from("trades")
      .select("id, side, shares, cost, created_at, outcome_id, profile:profiles(username, avatar_url)")
      .eq("market_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    profile
      ? supabase
          .from("positions")
          .select("outcome_id, shares")
          .eq("market_id", id)
          .eq("user_id", profile.id)
      : Promise.resolve({ data: [] as { outcome_id: string; shares: number }[] }),
  ]);

  const outcomes = outcomePrices(
    [...market.outcomes].sort((a, b) => a.sort_order - b.sort_order),
    market.liquidity_b,
  );
  const labelById = new Map(outcomes.map((o) => [o.id, o.label]));

  const activity: ActivityItem[] = (trades ?? []).map((t) => {
    const p = (Array.isArray(t.profile) ? t.profile[0] : t.profile) as
      | { username: string; avatar_url: string | null }
      | null;
    return {
      id: t.id,
      side: t.side,
      shares: Number(t.shares),
      cost: Number(t.cost),
      created_at: t.created_at,
      outcome_label: labelById.get(t.outcome_id) ?? "",
      username: p?.username ?? "?",
      avatar_url: p?.avatar_url ?? null,
    };
  });

  const positions = Object.fromEntries(
    (myPositions ?? []).map((p) => [p.outcome_id, Number(p.shares)]),
  );

  return (
    <>
      <RealtimeRefresher
        channel={`market-${id}`}
        subscriptions={[
          { table: "outcomes", filter: `market_id=eq.${id}` },
          { table: "markets", filter: `id=eq.${id}` },
        ]}
      />
      <MarketView
        market={market}
        race={market.race}
        athlete={market.athlete}
        outcomes={outcomes}
        snapshots={(snapshots ?? []) as PriceSnapshot[]}
        activity={activity}
        positions={positions}
        balance={profile ? Number(profile.balance) : null}
        isLoggedIn={Boolean(profile)}
      />
    </>
  );
}
