"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { placeTimePrediction } from "@/actions/predictions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCredits, predictionPayout } from "@/lib/format";
import { formatTime, parseTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export function PredictionPanel({
  marketId,
  balance,
  isOpen,
  isLoggedIn,
  existing,
  maxErrorSeconds = 600,
  maxMultiplier = 2,
  resolvedActual,
}: {
  marketId: string;
  balance: number | null;
  isOpen: boolean;
  isLoggedIn: boolean;
  existing: { predicted_seconds: number; stake: number; payout: number | null } | null;
  maxErrorSeconds?: number;
  maxMultiplier?: number;
  resolvedActual?: number | null;
}) {
  const [timeValue, setTimeValue] = useState("");
  const [stakeValue, setStakeValue] = useState("");
  const [pending, startTransition] = useTransition();

  const predicted = parseTime(timeValue.trim());
  const stake = Number(stakeValue.replace(",", "."));
  const validTime = predicted !== null;
  const validStake = Number.isFinite(stake) && stake > 0;
  const insufficient = balance !== null && validStake && stake > balance;

  const previewMax = useMemo(() => {
    if (!validStake) return null;
    return predictionPayout(stake, 0, maxErrorSeconds, maxMultiplier);
  }, [validStake, stake, maxErrorSeconds, maxMultiplier]);

  function submit() {
    if (!validTime || !validStake) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("market_id", marketId);
      fd.set("predicted_time", timeValue.trim());
      fd.set("stake", String(stake));
      const res = await placeTimePrediction(null, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(res?.ok ?? "Done");
        setTimeValue("");
        setStakeValue("");
      }
    });
  }

  if (existing) {
    const err =
      resolvedActual != null ? Math.abs(existing.predicted_seconds - resolvedActual) : null;
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-medium">Your prediction</h3>
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="Predicted time" value={formatTime(existing.predicted_seconds)} />
          <Row label="Stake" value={formatCredits(existing.stake)} />
          {existing.payout != null ? (
            <Row
              label="Payout"
              value={formatCredits(existing.payout)}
              highlight={existing.payout > 0}
            />
          ) : (
            <Row
              label="Max if exact"
              value={formatCredits(
                predictionPayout(Number(existing.stake), 0, maxErrorSeconds, maxMultiplier),
              )}
            />
          )}
          {err != null && <Row label="Error" value={`${err}s`} />}
        </dl>
        <p className="text-[11px] text-muted-foreground">
          Closer to the real finish time returns more credits (up to {maxMultiplier}×). No odds
          shown — virtual credits only, not transferable or convertible to cash.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <h3 className="text-sm font-medium">Predict finish time</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Stake virtual credits on an exact time. Payout shrinks with your error (zero beyond{" "}
          {Math.round(maxErrorSeconds / 60)} min). No market odds.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">Predicted time (mm:ss or h:mm:ss)</span>
        <Input
          placeholder="1:45:00"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          className="h-11 font-semibold"
        />
        {timeValue && !validTime && <p className="text-xs text-no">Invalid time</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Stake (credits)</span>
          {balance !== null && <span>Balance: {formatCredits(balance)}</span>}
        </div>
        <Input
          inputMode="decimal"
          placeholder="0"
          value={stakeValue}
          onChange={(e) => setStakeValue(e.target.value)}
          className="h-11 text-right text-lg font-semibold"
        />
        <div className="flex gap-2">
          {[10, 50, 100].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setStakeValue(String((validStake ? stake : 0) + v))}
              className="flex-1 rounded-md bg-muted py-1 text-xs hover:bg-secondary"
            >
              +{v}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setStakeValue(String(Math.floor((balance ?? 0) * 100) / 100))}
            className="flex-1 rounded-md bg-muted py-1 text-xs hover:bg-secondary"
          >
            Max
          </button>
        </div>
      </div>

      {previewMax != null && (
        <dl className="flex flex-col gap-1.5 text-sm">
          <Row label="Max payout if exact" value={formatCredits(previewMax)} highlight />
          <Row
            label={`Payout at ${Math.round(maxErrorSeconds / 2)}s error`}
            value={formatCredits(
              predictionPayout(stake, maxErrorSeconds / 2, maxErrorSeconds, maxMultiplier),
            )}
          />
        </dl>
      )}

      {!isLoggedIn ? (
        <Link
          href={`/login?next=${encodeURIComponent(`/markets/${marketId}`)}`}
          className={buttonVariants({ size: "lg", className: "h-11" })}
        >
          Fai il tuo pronostico
        </Link>
      ) : (
        <Button
          size="lg"
          className="h-11 bg-yes text-white hover:bg-yes/85"
          disabled={!isOpen || !validTime || !validStake || insufficient || pending}
          onClick={submit}
        >
          {!isOpen
            ? "Mercato chiuso"
            : insufficient
              ? "Saldo insufficiente"
              : pending
                ? "Invio..."
                : "Blocca pronostico"}
        </Button>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Solo crediti virtuali — non trasferibili, non convertibili in denaro.
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
