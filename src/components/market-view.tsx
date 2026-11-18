"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, HelpCircle, MapPin, Ruler } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PriceChart, OUTCOME_COLORS, YES_NO_COLORS } from "@/components/price-chart";
import { TradePanel, type TradeOutcome } from "@/components/trade-panel";
import { cn } from "@/lib/utils";
import { marketTitle } from "@/lib/markets";
import {
  formatCents,
  formatCredits,
  formatDate,
  formatPercent,
  formatRelative,
  formatVolume,
} from "@/lib/format";
import { formatPace, formatTime } from "@/lib/time";
import type { Athlete, Market, PriceSnapshot, Race } from "@/lib/types";

export interface ActivityItem {
  id: number;
  username: string;
  avatar_url: string | null;
  side: "buy" | "sell";
  outcome_label: string;
  shares: number;
  cost: number;
  created_at: string;
}

export function MarketView({
  market,
  race,
  athlete,
  outcomes,
  snapshots,
  activity,
  positions,
  balance,
  isLoggedIn,
}: {
  market: Market;
  race: Race;
  athlete: Athlete | null;
  outcomes: TradeOutcome[];
  snapshots: PriceSnapshot[];
  activity: ActivityItem[];
  positions: Record<string, number>;
  balance: number | null;
  isLoggedIn: boolean;
}) {
  const isCustom = market.kind === "custom";
  const colors = isCustom ? YES_NO_COLORS : OUTCOME_COLORS;

  const [selected, setSelected] = useState(() => {
    if (isCustom) return 0;
    let best = 0;
    outcomes.forEach((o, i) => {
      if (o.price > outcomes[best].price) best = i;
    });
    return best;
  });

  const resolved = market.status === "resolved";
  const isOpen =
    market.status === "open" &&
    (market.closes_at === null || new Date(market.closes_at) > new Date());
  const winner = outcomes.find((o) => o.id === market.winning_outcome_id);

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex items-start gap-4">
          {athlete ? (
            <Avatar name={athlete.name} url={athlete.avatar_url} size={64} className="rounded-xl" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <HelpCircle className="size-8" />
            </span>
          )}
          <div className="min-w-0">
            <Link href={`/races/${race.id}`} className="text-sm text-muted-foreground hover:underline">
              {race.name}
            </Link>
            <h1 className="text-2xl font-semibold leading-tight">{marketTitle(market, athlete)}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{formatVolume(market.volume)} credits vol.</span>
              <span className="flex items-center gap-1">
                <Ruler className="size-3" /> {Number(race.distance_km)} km
              </span>
              {race.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {race.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {resolved
                  ? "Resolved"
                  : isOpen && market.closes_at
                    ? `Closes ${formatRelative(market.closes_at)}`
                    : `Race on ${formatDate(race.starts_at)}`}
              </span>
            </div>
          </div>
        </div>

        {resolved && winner && (
          <div className="flex items-center gap-3 rounded-xl border border-yes/40 bg-yes/10 p-4">
            <CheckCircle2 className="size-6 text-yes" />
            {market.actual_time_seconds ? (
              <div>
                <p className="font-semibold">
                  Official time: {formatTime(market.actual_time_seconds)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({formatPace(market.actual_time_seconds, Number(race.distance_km))})
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">Winning bracket: {winner.label}</p>
                {market.strava_activity_id && (
                  <a
                    href={`https://www.strava.com/activities/${market.strava_activity_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-medium text-[#fc5200] hover:underline"
                  >
                    Verified with Strava · View on Strava
                  </a>
                )}
              </div>
            ) : (
              <p className="font-semibold">Resolved: {winner.label}</p>
            )}
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          {isCustom && !resolved && (
            <p className="mb-3 text-3xl font-semibold">
              {formatPercent(outcomes[0].price)}{" "}
              <span className="text-base font-normal text-muted-foreground">chance</span>
            </p>
          )}
          <PriceChart outcomes={outcomes} snapshots={snapshots} colors={colors} />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
            <span>{isCustom ? "Outcome" : "Time bracket"}</span>
            <span>Probability</span>
          </div>
          {outcomes.map((o, i) => {
            const owned = positions[o.id] ?? 0;
            const isWinner = o.id === market.winning_outcome_id;
            const isNo = isCustom && i === 1;
            return (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-4 border-b px-4 py-3 last:border-b-0",
                  i === selected && !resolved && "bg-muted/40",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.label}</p>
                  {owned > 0 && (
                    <p className="text-xs text-primary">You hold {owned.toFixed(2)} shares</p>
                  )}
                </div>
                <span className="text-2xl font-semibold">
                  {resolved ? (isWinner ? "100%" : "0%") : formatPercent(o.price)}
                </span>
                {!resolved && (
                  <button
                    onClick={() => setSelected(i)}
                    disabled={!isOpen}
                    className={cn(
                      "w-32 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                      isNo
                        ? "bg-no/15 text-no hover:bg-no/25"
                        : "bg-yes/15 text-yes hover:bg-yes/25",
                    )}
                  >
                    Buy {isCustom ? o.label : ""} {formatCents(o.price)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-medium">Activity</h2>
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No trades yet. Be the first!
            </p>
          ) : (
            <ul>
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
                  <Avatar name={a.username} url={a.avatar_url} size={24} />
                  <span className="min-w-0 flex-1 truncate">
                    <b>{a.username}</b>{" "}
                    <span className={a.side === "buy" ? "text-yes" : "text-no"}>
                      {a.side === "buy" ? "bought" : "sold"}
                    </span>{" "}
                    {Number(a.shares).toFixed(1)} <b>{a.outcome_label}</b> shares for{" "}
                    {formatCredits(a.cost)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelative(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {athlete?.bio && (
          <div className="rounded-xl border bg-card p-4 text-sm">
            <h2 className="mb-1 font-medium">About {athlete.name}</h2>
            <p className="text-muted-foreground">{athlete.bio}</p>
            {athlete.personal_best_seconds && (
              <p className="mt-2">
                Personal best: <b>{formatTime(athlete.personal_best_seconds)}</b>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        {resolved ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            This market is resolved. Winnings have been paid out automatically.
          </div>
        ) : (
          <TradePanel
            outcomes={outcomes}
            b={Number(market.liquidity_b)}
            selected={selected}
            onSelect={setSelected}
            balance={balance}
            positions={positions}
            isOpen={isOpen}
            isLoggedIn={isLoggedIn}
            isYesNo={isCustom}
          />
        )}
      </div>
    </div>
  );
}
