"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, MapPin, Ruler } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PriceChart, OUTCOME_COLORS } from "@/components/price-chart";
import { TradePanel, type TradeOutcome } from "@/components/trade-panel";
import { cn } from "@/lib/utils";
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
  athlete: Athlete;
  outcomes: TradeOutcome[];
  snapshots: PriceSnapshot[];
  activity: ActivityItem[];
  positions: Record<string, number>;
  balance: number | null;
  isLoggedIn: boolean;
}) {
  const [selected, setSelected] = useState(() => {
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
          <Avatar name={athlete.name} url={athlete.avatar_url} size={64} className="rounded-xl" />
          <div className="min-w-0">
            <Link href={`/races/${race.id}`} className="text-sm text-muted-foreground hover:underline">
              {race.name}
            </Link>
            <h1 className="text-2xl font-semibold leading-tight">
              Che tempo farà {athlete.name}?
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{formatVolume(market.volume)} crediti vol.</span>
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
                  ? `Risolto`
                  : isOpen && market.closes_at
                    ? `Chiude ${formatRelative(market.closes_at)}`
                    : `Gara del ${formatDate(race.starts_at)}`}
              </span>
            </div>
          </div>
        </div>

        {resolved && winner && market.actual_time_seconds && (
          <div className="flex items-center gap-3 rounded-xl border border-yes/40 bg-yes/10 p-4">
            <CheckCircle2 className="size-6 text-yes" />
            <div>
              <p className="font-semibold">
                Tempo ufficiale: {formatTime(market.actual_time_seconds)}{" "}
                <span className="font-normal text-muted-foreground">
                  ({formatPace(market.actual_time_seconds, Number(race.distance_km))})
                </span>
              </p>
              <p className="text-sm text-muted-foreground">Fascia vincente: {winner.label}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card p-4">
          <PriceChart outcomes={outcomes} snapshots={snapshots} />
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
            <span>Fascia di tempo</span>
            <span>Probabilità</span>
          </div>
          {outcomes.map((o, i) => {
            const owned = positions[o.id] ?? 0;
            const isWinner = o.id === market.winning_outcome_id;
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
                  style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{o.label}</p>
                  {owned > 0 && (
                    <p className="text-xs text-primary">Hai {owned.toFixed(2)} quote</p>
                  )}
                </div>
                <span className="text-2xl font-semibold">
                  {resolved ? (isWinner ? "100%" : "0%") : formatPercent(o.price)}
                </span>
                {!resolved && (
                  <button
                    onClick={() => setSelected(i)}
                    disabled={!isOpen}
                    className="w-28 rounded-lg bg-yes/15 px-3 py-2 text-sm font-medium text-yes transition-colors hover:bg-yes/25 disabled:opacity-50"
                  >
                    Compra {formatCents(o.price)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-medium">Attività</h2>
          {activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Ancora nessuna giocata. Sii il primo!
            </p>
          ) : (
            <ul>
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
                  <Avatar name={a.username} url={a.avatar_url} size={24} />
                  <span className="min-w-0 flex-1 truncate">
                    <b>{a.username}</b>{" "}
                    <span className={a.side === "buy" ? "text-yes" : "text-no"}>
                      {a.side === "buy" ? "ha comprato" : "ha venduto"}
                    </span>{" "}
                    {Number(a.shares).toFixed(1)} quote <b>{a.outcome_label}</b> per{" "}
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

        {athlete.bio && (
          <div className="rounded-xl border bg-card p-4 text-sm">
            <h2 className="mb-1 font-medium">Su {athlete.name}</h2>
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
            Mercato risolto. Le vincite sono state accreditate automaticamente.
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
          />
        )}
      </div>
    </div>
  );
}
