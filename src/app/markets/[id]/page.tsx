import { notFound } from "next/navigation";
import { MarketView, type ActivityItem } from "@/components/market-view";
import { AutoRefresh } from "@/components/auto-refresh";
import { getMarket, isUuid } from "@/lib/queries";
import { outcomePrices } from "@/lib/lmsr";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import type { PriceSnapshot } from "@/lib/types";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const market = await getMarket(id);
  if (!market) notFound();

  const profile = await getCurrentProfile();

  const [snapshots, trades, myPositions] = await Promise.all([
    query<PriceSnapshot>(
      `select outcome_id, price, created_at from price_snapshots
        where market_id = $1 order by created_at limit 5000`,
      [id],
    ),
    query<Omit<ActivityItem, "outcome_label"> & { outcome_id: string }>(
      `select t.id, t.side, t.shares, t.cost, t.created_at, t.outcome_id, u.username, u.avatar_url
         from trades t join users u on u.id = t.user_id
        where t.market_id = $1
        order by t.created_at desc limit 30`,
      [id],
    ),
    profile
      ? query<{ outcome_id: string; shares: number }>(
          "select outcome_id, shares from positions where market_id = $1 and user_id = $2",
          [id, profile.id],
        )
      : Promise.resolve([]),
  ]);

  const outcomes = outcomePrices(
    [...market.outcomes].sort((a, b) => a.sort_order - b.sort_order),
    market.liquidity_b,
  );
  const labelById = new Map(outcomes.map((o) => [o.id, o.label]));

  const activity: ActivityItem[] = trades.map((t) => ({
    ...t,
    outcome_label: labelById.get(t.outcome_id) ?? "",
  }));

  const positions = Object.fromEntries(myPositions.map((p) => [p.outcome_id, Number(p.shares)]));

  return (
    <>
      <AutoRefresh />
      <MarketView
        market={market}
        race={market.race}
        athlete={market.athlete}
        outcomes={outcomes}
        snapshots={snapshots}
        activity={activity}
        positions={positions}
        balance={profile ? Number(profile.balance) : null}
        isLoggedIn={Boolean(profile)}
      />
    </>
  );
}
