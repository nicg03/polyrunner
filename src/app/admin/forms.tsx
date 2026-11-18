"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  closeMarket,
  createAthlete,
  createCustomMarket,
  createMarket,
  createRace,
  reopenMarket,
  resolveMarket,
  resolveMarketOutcome,
} from "@/actions/admin";
import { bucketsFromThresholds, parseTime } from "@/lib/time";
import type { Athlete, MarketKind, Race } from "@/lib/types";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// datetime-local is in the browser's time zone: convert to ISO before sending it to the server.
function LocalDateTime({ name, required }: { name: string; required?: boolean }) {
  const [local, setLocal] = useState("");
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <>
      <Input
        type="datetime-local"
        required={required}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

function RaceSelect({ races }: { races: Race[] }) {
  return (
    <select name="race_id" required className={selectClass} defaultValue="">
      <option value="" disabled>
        Choose...
      </option>
      {races.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

function AthleteSelect({ athletes, optional }: { athletes: Athlete[]; optional?: boolean }) {
  return (
    <select name="athlete_id" required={!optional} className={selectClass} defaultValue="">
      <option value="" disabled={!optional}>
        {optional ? "None" : "Choose..."}
      </option>
      {athletes.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

export function RaceForm() {
  return (
    <ActionForm action={createRace} className="flex flex-col gap-3">
      {(pending) => (
        <>
          <Field label="Race name">
            <Input name="name" required placeholder="Milano Marathon 2027" />
          </Field>
          <Field label="Start time">
            <LocalDateTime name="starts_at" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance (km)">
              <Input name="distance_km" required inputMode="decimal" placeholder="42.195" />
            </Field>
            <Field label="Location">
              <Input name="location" placeholder="Milan" />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            Create race
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function AthleteForm() {
  return (
    <ActionForm action={createAthlete} className="flex flex-col gap-3">
      {(pending) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input name="name" required placeholder="Marco" />
            </Field>
            <Field label="Personal best">
              <Input name="personal_best" placeholder="3:29:45" />
            </Field>
          </div>
          <Field label="Bio">
            <Input name="bio" placeholder="Weekend marathoner" />
          </Field>
          <Field label="Avatar URL (optional)">
            <Input name="avatar_url" type="url" placeholder="https://..." />
          </Field>
          <Button type="submit" disabled={pending}>
            Add athlete
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function MarketForm({ races, athletes }: { races: Race[]; athletes: Athlete[] }) {
  const [thresholds, setThresholds] = useState("3:15:00, 3:30:00, 3:45:00");
  const [probs, setProbs] = useState<Record<number, string>>({});

  const { buckets, invalid } = useMemo(() => {
    const parts = thresholds.split(",").map((s) => s.trim()).filter(Boolean);
    const secs = parts.map(parseTime);
    const invalid = parts.filter((_, i) => secs[i] === null);
    return {
      buckets: bucketsFromThresholds(secs.filter((s): s is number => s !== null)),
      invalid,
    };
  }, [thresholds]);

  const outcomesJson = JSON.stringify(
    buckets.map((b, i) => ({ ...b, prob: probs[i] ? Number(probs[i]) / 100 : null })),
  );

  return (
    <ActionForm action={createMarket} className="flex flex-col gap-3" resetOnSuccess={false}>
      {(pending) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Race">
              <RaceSelect races={races} />
            </Field>
            <Field label="Athlete">
              <AthleteSelect athletes={athletes} />
            </Field>
          </div>
          <Field label="Time thresholds, comma separated (mm:ss or h:mm:ss)">
            <Input value={thresholds} onChange={(e) => setThresholds(e.target.value)} />
          </Field>
          {invalid.length > 0 && <p className="text-xs text-no">Invalid: {invalid.join(", ")}</p>}

          {buckets.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Generated brackets. Initial probabilities in % (optional, empty = uniform).
              </p>
              {buckets.map((b, i) => (
                <div key={b.label} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{b.label}</span>
                  <Input
                    className="w-20 text-right"
                    inputMode="decimal"
                    placeholder={String(Math.round(100 / buckets.length))}
                    value={probs[i] ?? ""}
                    onChange={(e) => setProbs({ ...probs, [i]: e.target.value })}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Liquidity b (higher = steadier prices)">
              <Input name="liquidity_b" defaultValue="100" inputMode="decimal" />
            </Field>
            <Field label="Trading closes (empty = race start)">
              <LocalDateTime name="closes_at" />
            </Field>
          </div>
          <input type="hidden" name="outcomes" value={outcomesJson} />
          <Button type="submit" disabled={pending || buckets.length < 2 || invalid.length > 0}>
            Create market
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function CustomMarketForm({ races, athletes }: { races: Race[]; athletes: Athlete[] }) {
  return (
    <ActionForm action={createCustomMarket} className="flex flex-col gap-3">
      {(pending) => (
        <>
          <Field label="Question">
            <Input
              name="question"
              required
              minLength={5}
              maxLength={140}
              placeholder="Will Marco stop to walk at any point?"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Race">
              <RaceSelect races={races} />
            </Field>
            <Field label="Athlete (optional)">
              <AthleteSelect athletes={athletes} optional />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Initial Yes %">
              <Input name="yes_prob" defaultValue="50" inputMode="decimal" />
            </Field>
            <Field label="Liquidity b">
              <Input name="liquidity_b" defaultValue="100" inputMode="decimal" />
            </Field>
            <Field label="Trading closes">
              <LocalDateTime name="closes_at" />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            Create Yes/No market
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function MarketAdminRow({
  marketId,
  title,
  subtitle,
  status,
  kind,
  outcomes,
}: {
  marketId: string;
  title: string;
  subtitle: string;
  status: string;
  kind: MarketKind;
  outcomes: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();

  function runAction(fn: () => Promise<{ ok?: string; error?: string } | null>) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (res?.ok) toast.success(res.ok);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {subtitle} · {status === "open" ? "open" : "closed"}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          runAction(() => (status === "open" ? closeMarket(marketId) : reopenMarket(marketId)))
        }
      >
        {status === "open" ? "Close trading" : "Reopen"}
      </Button>
      {kind === "custom" ? (
        <div className="flex items-center gap-2">
          {outcomes.map((o, i) => (
            <Button
              key={o.id}
              size="sm"
              disabled={pending}
              className={i === 0 ? "bg-yes text-white hover:bg-yes/85" : "bg-no text-white hover:bg-no/85"}
              onClick={() => {
                if (confirm(`Resolve as "${o.label}"? This cannot be undone.`)) {
                  runAction(() => resolveMarketOutcome(marketId, o.id));
                }
              }}
            >
              Resolve {o.label}
            </Button>
          ))}
        </div>
      ) : (
        <ActionForm action={resolveMarket} className="flex items-center gap-2">
          {(resolving) => (
            <>
              <input type="hidden" name="market_id" value={marketId} />
              <Input name="actual_time" required placeholder="Official time" className="w-28" />
              <Button type="submit" size="sm" disabled={resolving}>
                Resolve
              </Button>
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}
