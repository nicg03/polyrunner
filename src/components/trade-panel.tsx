"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buyShares, sellShares } from "@/actions/trade";
import { prices, proceedsForShares, sharesForAmount, withDelta } from "@/lib/lmsr";
import { formatCents, formatStake, formatPercent, stakeUnit } from "@/lib/format";
import type { MarketStake } from "@/lib/types";

export interface TradeOutcome {
  id: string;
  label: string;
  q_shares: number;
  price: number;
}

export function TradePanel({
  outcomes,
  b,
  selected,
  onSelect,
  balance,
  positions,
  isOpen,
  isLoggedIn,
  isYesNo = false,
  stake = "credits",
}: {
  outcomes: TradeOutcome[];
  b: number;
  selected: number;
  onSelect: (i: number) => void;
  balance: number | null;
  positions: Record<string, number>;
  isOpen: boolean;
  isLoggedIn: boolean;
  isYesNo?: boolean;
  stake?: MarketStake;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const outcome = outcomes[selected];
  const q = useMemo(() => outcomes.map((o) => Number(o.q_shares)), [outcomes]);
  const owned = positions[outcome.id] ?? 0;
  const amount = Number(value.replace(",", "."));
  const valid = Number.isFinite(amount) && amount > 0;

  const preview = useMemo(() => {
    if (!valid) return null;
    if (side === "buy") {
      const shares = sharesForAmount(q, b, selected, amount);
      const newPrice = prices(withDelta(q, selected, shares), b)[selected];
      return { shares, avg: amount / shares, payout: shares, newPrice };
    }
    const shares = Math.min(amount, owned);
    const proceeds = proceedsForShares(q, b, selected, shares);
    const newPrice = prices(withDelta(q, selected, -shares), b)[selected];
    return { shares, avg: shares > 0 ? proceeds / shares : 0, proceeds, newPrice };
  }, [valid, side, q, b, selected, amount, owned]);

  const insufficient =
    side === "buy" ? balance !== null && valid && amount > balance : valid && amount > owned + 1e-9;

  function submit() {
    if (!valid) return;
    startTransition(async () => {
      const res =
        side === "buy"
          ? await buyShares(outcome.id, amount)
          : await sellShares(outcome.id, Math.min(amount, owned));
      if (res?.error) toast.error(res.error);
      else {
        toast.success(res?.ok ?? "Done");
        setValue("");
      }
    });
  }

  const quick = side === "buy" ? [10, 50, 100] : [];

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex border-b">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setValue("");
            }}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
              side === s
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">{isYesNo ? "Outcome" : "Time bracket"}</span>
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((o, i) => (
            <button
              key={o.id}
              onClick={() => onSelect(i)}
              className={cn(
                "flex flex-col items-start rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                i !== selected && "bg-muted/40 text-muted-foreground hover:bg-muted",
                i === selected &&
                  (isYesNo && i === 1
                    ? "border-no bg-no/15 text-foreground"
                    : "border-yes bg-yes/15 text-foreground"),
              )}
            >
              <span className="truncate font-medium">{o.label}</span>
              <span className={i === selected ? (isYesNo && i === 1 ? "text-no" : "text-yes") : ""}>
                {formatCents(o.price)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{side === "buy" ? `Amount (${stakeUnit(stake)})` : "Shares to sell"}</span>
          {side === "buy" && balance !== null && (
            <span>Balance: {formatStake(balance, stake)}</span>
          )}
          {side === "sell" && <span>You hold: {owned.toFixed(2)}</span>}
        </div>
        <Input
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 text-right text-lg font-semibold"
        />
        <div className="flex gap-2">
          {quick.map((v) => (
            <button
              key={v}
              onClick={() => setValue(String((valid ? amount : 0) + v))}
              className="flex-1 rounded-md bg-muted py-1 text-xs hover:bg-secondary"
            >
              +{v}
            </button>
          ))}
          <button
            onClick={() =>
              setValue(
                side === "buy"
                  ? String(Math.floor((balance ?? 0) * 100) / 100)
                  : String(owned),
              )
            }
            className="flex-1 rounded-md bg-muted py-1 text-xs hover:bg-secondary"
          >
            Max
          </button>
        </div>
      </div>

      {preview && (
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="Avg. price" value={formatCents(preview.avg)} />
          <Row label="Shares" value={preview.shares.toFixed(2)} />
          <Row
            label="New probability"
            value={`${formatPercent(outcome.price)} → ${formatPercent(preview.newPrice)}`}
          />
          {"payout" in preview && preview.payout !== undefined ? (
            <Row
              label="Potential payout"
              value={`${formatStake(preview.payout, stake)} (+${Math.round(
                ((preview.payout - amount) / amount) * 100,
              )}%)`}
              highlight
            />
          ) : (
            <Row
              label="You receive"
              value={formatStake(preview.proceeds ?? 0, stake)}
              highlight
            />
          )}
        </dl>
      )}

      {!isLoggedIn ? (
        <Link href="/login" className={buttonVariants({ size: "lg", className: "h-11" })}>
          Log in to trade
        </Link>
      ) : (
        <Button
          size="lg"
          className={cn(
            "h-11 text-white",
            side === "buy" ? "bg-yes hover:bg-yes/85" : "bg-no hover:bg-no/85",
          )}
          disabled={!isOpen || !valid || insufficient || pending}
          onClick={submit}
        >
          {!isOpen
            ? "Market closed"
            : insufficient
              ? side === "buy"
                ? "Insufficient balance"
                : "Not enough shares"
              : pending
                ? "Submitting..."
                : side === "buy"
                  ? `Buy ${outcome.label}`
                  : `Sell ${outcome.label}`}
        </Button>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        {stake === "beer"
          ? "Each share pays 1 beer if this outcome wins. 1 beer = 1 credit in your wallet — settle the round with friends in real life."
          : "Each share pays 1 credit if this outcome wins. Virtual credits, just for fun."}
      </p>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", highlight && "text-yes")}>{value}</dd>
    </div>
  );
}
