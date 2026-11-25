import { notFound } from "next/navigation";
import { MarketView, type ActivityItem, type VerifiedBy } from "@/components/market-view";
import { AutoRefresh } from "@/components/auto-refresh";
import { getMarket, isUuid } from "@/lib/queries";
import { outcomePrices } from "@/lib/lmsr";
import { getCurrentProfile } from "@/lib/auth";
import { predictionParams } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
import { formatTime } from "@/lib/time";
import type { ClaimStatus, PriceSnapshot, TimePrediction } from "@/lib/types";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const profile = await getCurrentProfile();
  // Athlete subject / creator / admin can see pending/hidden markets
  let market = await getMarket(id, { includeHidden: true });
  if (!market) notFound();

  const isAthleteSubject = Boolean(profile && market.athlete?.user_id === profile.id);
  const canSeeHidden =
    isAthleteSubject ||
    Boolean(profile?.is_admin) ||
    Boolean(profile && market.created_by === profile.id);

  const visible =
    !market.hidden_by_athlete &&
    (market.approval_status == null ||
      market.approval_status === "auto" ||
      market.approval_status === "approved");

  if (!visible && !canSeeHidden) notFound();

  // Public visitors use filtered getMarket; already loaded with includeHidden
  if (!canSeeHidden) {
    market = (await getMarket(id)) ?? market;
  }

  const isExact = market.pricing === "exact_time";
  const raceStarted = new Date(market.race.starts_at) <= new Date();

  const [myClaim, verifiedBy, medianRow] = await Promise.all([
    profile && market.kind === "time" && market.status !== "resolved"
      ? queryOne<{ status: ClaimStatus; time_seconds: number }>(
          `select status, time_seconds from result_claims
            where market_id = $1 and user_id = $2 order by created_at desc limit 1`,
          [id, profile.id],
        )
      : Promise.resolve(null),
    market.result_claim_id
      ? queryOne<VerifiedBy>("select id, evidence_kind, evidence_url from result_claims where id = $1", [
          market.result_claim_id,
        ])
      : Promise.resolve(null),
    isExact
      ? queryOne<{ median: number | null }>(
          `select percentile_cont(0.5) within group (order by predicted_seconds) as median
             from time_predictions where market_id = $1`,
          [id],
        )
      : Promise.resolve(null),
  ]);

  const submitResult =
    profile && market.kind === "time" && market.status !== "resolved" && raceStarted
      ? { myClaim }
      : null;

  const marketConsensusSeconds = medianRow?.median != null ? Number(medianRow.median) : null;

  if (isExact) {
    const [predictions, myPrediction, params] = await Promise.all([
      query<TimePrediction & { username: string; avatar_url: string | null }>(
        `select tp.*, u.username, u.avatar_url
           from time_predictions tp join users u on u.id = tp.user_id
          where tp.market_id = $1
          order by tp.created_at desc limit 30`,
        [id],
      ),
      profile
        ? queryOne<TimePrediction>(
            "select * from time_predictions where market_id = $1 and user_id = $2",
            [id, profile.id],
          )
        : Promise.resolve(null),
      predictionParams(),
    ]);

    const activity: ActivityItem[] = predictions.map((p) => ({
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      side: "predict",
      outcome_label: formatTime(Number(p.predicted_seconds)),
      shares: 0,
      cost: Number(p.stake),
      created_at: p.created_at,
    }));

    return (
      <>
        <AutoRefresh />
        <MarketView
          market={market}
          race={market.race}
          athlete={market.athlete}
          outcomes={[]}
          snapshots={[]}
          activity={activity}
          positions={{}}
          balance={profile ? Number(profile.balance) : null}
          isLoggedIn={Boolean(profile)}
          verifiedBy={verifiedBy}
          submitResult={submitResult}
          myPrediction={myPrediction}
          predictionParams={params}
          isAthleteSubject={isAthleteSubject}
          marketConsensusSeconds={marketConsensusSeconds}
        />
      </>
    );
  }

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
        verifiedBy={verifiedBy}
        submitResult={submitResult}
        isAthleteSubject={isAthleteSubject}
        marketConsensusSeconds={null}
      />
    </>
  );
}
