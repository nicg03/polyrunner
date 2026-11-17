import Link from "next/link";
import { Clock, CheckCircle2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { outcomePrices } from "@/lib/lmsr";
import { formatPercent, formatRelative, formatVolume } from "@/lib/format";
import { formatTime } from "@/lib/time";
import type { MarketWithRelations } from "@/lib/types";

export function MarketCard({ market }: { market: MarketWithRelations }) {
  const outcomes = outcomePrices(
    [...market.outcomes].sort((a, b) => a.sort_order - b.sort_order),
    market.liquidity_b,
  );
  const top = [...outcomes].sort((a, b) => b.price - a.price).slice(0, 3);
  const resolved = market.status === "resolved";
  const winner = outcomes.find((o) => o.id === market.winning_outcome_id);
  const isClosed =
    market.status !== "open" ||
    (market.closes_at !== null && new Date(market.closes_at) <= new Date());

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--card),white_3%)]"
    >
      <div className="flex items-start gap-3">
        <Avatar name={market.athlete.name} url={market.athlete.avatar_url} size={40} className="rounded-lg" />
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">
            Che tempo farà {market.athlete.name}?
          </p>
          <p className="truncate text-xs text-muted-foreground">{market.race.name}</p>
        </div>
      </div>

      {resolved && winner ? (
        <div className="flex items-center gap-2 rounded-lg bg-yes/10 px-3 py-2 text-sm text-yes">
          <CheckCircle2 className="size-4" />
          <span className="font-medium">{winner.label}</span>
          {market.actual_time_seconds && (
            <span className="ml-auto font-mono">{formatTime(market.actual_time_seconds)}</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {top.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-sm">
              <span className="w-32 shrink-0 truncate text-muted-foreground">{o.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(o.price * 100, 2)}%` }}
                />
              </div>
              <span className="w-10 text-right font-semibold">{formatPercent(o.price)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <span>{formatVolume(market.volume)} crediti vol.</span>
        {resolved ? (
          <span>Risolto</span>
        ) : isClosed ? (
          <span>In attesa del risultato</span>
        ) : market.closes_at ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> chiude {formatRelative(market.closes_at)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
