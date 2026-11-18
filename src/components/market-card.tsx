import Link from "next/link";
import { Clock, CheckCircle2, HelpCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { outcomePrices } from "@/lib/lmsr";
import { marketTitle } from "@/lib/markets";
import { formatPercent, formatRelative, formatVolume, stakeUnit } from "@/lib/format";
import { formatTime } from "@/lib/time";
import type { MarketWithRelations } from "@/lib/types";

export function MarketCard({ market }: { market: MarketWithRelations }) {
  const outcomes = outcomePrices(
    [...market.outcomes].sort((a, b) => a.sort_order - b.sort_order),
    market.liquidity_b,
  );
  const resolved = market.status === "resolved";
  const winner = outcomes.find((o) => o.id === market.winning_outcome_id);
  const isClosed =
    market.status !== "open" ||
    (market.closes_at !== null && new Date(market.closes_at) <= new Date());
  const isCustom = market.kind === "custom";

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--card),white_3%)]"
    >
      <div className="flex items-start gap-3">
        {market.athlete ? (
          <Avatar name={market.athlete.name} url={market.athlete.avatar_url} size={40} className="rounded-lg" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <HelpCircle className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium leading-snug">{marketTitle(market, market.athlete)}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {market.athlete?.category === "pro" && (
              <span className="rounded bg-amber-400/15 px-1 text-[10px] font-semibold text-amber-400">PRO</span>
            )}
            {market.stake === "beer" && (
              <span className="rounded bg-amber-600/15 px-1 text-[10px] font-semibold text-amber-600">BEER</span>
            )}
            {market.race.name}
          </p>
        </div>
        {isCustom && !resolved && <YesGauge price={outcomes[0]?.price ?? 0} />}
      </div>

      {resolved && winner ? (
        <div className="flex items-center gap-2 rounded-lg bg-yes/10 px-3 py-2 text-sm text-yes">
          <CheckCircle2 className="size-4" />
          <span className="font-medium">{winner.label}</span>
          {market.actual_time_seconds && (
            <span className="ml-auto font-mono">{formatTime(market.actual_time_seconds)}</span>
          )}
        </div>
      ) : isCustom ? (
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((o, i) => (
            <span
              key={o.id}
              className={
                i === 0
                  ? "rounded-lg bg-yes/15 py-2 text-center text-sm font-medium text-yes"
                  : "rounded-lg bg-no/15 py-2 text-center text-sm font-medium text-no"
              }
            >
              Buy {o.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...outcomes]
            .sort((a, b) => b.price - a.price)
            .slice(0, 3)
            .map((o) => (
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
        <span>
          {formatVolume(market.volume)} {stakeUnit(market.stake ?? "credits")} vol.
        </span>
        {resolved ? (
          <span>Resolved</span>
        ) : isClosed ? (
          <span>Awaiting result</span>
        ) : market.closes_at ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> closes {formatRelative(market.closes_at)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function YesGauge({ price }: { price: number }) {
  const pct = Math.round(price * 100);
  const radius = 18;
  const circumference = Math.PI * radius;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <svg width="48" height="28" viewBox="0 0 48 28">
        <path
          d="M 6 24 A 18 18 0 0 1 42 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 6 24 A 18 18 0 0 1 42 24"
          fill="none"
          stroke={pct >= 50 ? "var(--yes)" : "var(--no)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
        />
      </svg>
      <span className="-mt-2 text-sm font-semibold">{pct}%</span>
      <span className="text-[10px] text-muted-foreground">chance</span>
    </div>
  );
}
