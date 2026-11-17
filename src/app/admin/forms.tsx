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
  createMarket,
  createRace,
  reopenMarket,
  resolveMarket,
} from "@/actions/admin";
import { bucketsFromThresholds, parseTime } from "@/lib/time";
import type { Athlete, Race } from "@/lib/types";

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

// datetime-local è nel fuso del browser: lo convertiamo in ISO prima di inviarlo al server.
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

export function RaceForm() {
  return (
    <ActionForm action={createRace} className="flex flex-col gap-3">
      {(pending) => (
        <>
          <Field label="Nome gara">
            <Input name="name" required placeholder="Milano Marathon 2027" />
          </Field>
          <Field label="Partenza">
            <LocalDateTime name="starts_at" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distanza (km)">
              <Input name="distance_km" required inputMode="decimal" placeholder="42.195" />
            </Field>
            <Field label="Luogo">
              <Input name="location" placeholder="Milano" />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            Crea gara
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
            <Field label="Nome">
              <Input name="name" required placeholder="Marco" />
            </Field>
            <Field label="Personal best">
              <Input name="personal_best" placeholder="3:29:45" />
            </Field>
          </div>
          <Field label="Bio">
            <Input name="bio" placeholder="Maratoneta della domenica" />
          </Field>
          <Field label="URL avatar (opzionale)">
            <Input name="avatar_url" type="url" placeholder="https://..." />
          </Field>
          <Button type="submit" disabled={pending}>
            Aggiungi atleta
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
            <Field label="Gara">
              <select name="race_id" required className={selectClass} defaultValue="">
                <option value="" disabled>
                  Scegli...
                </option>
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Atleta">
              <select name="athlete_id" required className={selectClass} defaultValue="">
                <option value="" disabled>
                  Scegli...
                </option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Soglie di tempo, separate da virgola (mm:ss o h:mm:ss)">
            <Input value={thresholds} onChange={(e) => setThresholds(e.target.value)} />
          </Field>
          {invalid.length > 0 && (
            <p className="text-xs text-no">Non valide: {invalid.join(", ")}</p>
          )}

          {buckets.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Fasce generate. Probabilità iniziali in % (opzionali, vuoto = uniforme).
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
            <Field label="Liquidità b (più alta = prezzi più stabili)">
              <Input name="liquidity_b" defaultValue="100" inputMode="decimal" />
            </Field>
            <Field label="Chiusura giocate (vuoto = partenza)">
              <LocalDateTime name="closes_at" />
            </Field>
          </div>
          <input type="hidden" name="outcomes" value={outcomesJson} />
          <Button type="submit" disabled={pending || buckets.length < 2 || invalid.length > 0}>
            Crea mercato
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
}: {
  marketId: string;
  title: string;
  subtitle: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = status === "open" ? await closeMarket(marketId) : await reopenMarket(marketId);
      if (res?.error) toast.error(res.error);
      else if (res?.ok) toast.success(res.ok);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">
          {subtitle} · {status === "open" ? "aperto" : "chiuso"}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
        {status === "open" ? "Chiudi giocate" : "Riapri"}
      </Button>
      <ActionForm action={resolveMarket} className="flex items-center gap-2">
        {(resolving) => (
          <>
            <input type="hidden" name="market_id" value={marketId} />
            <Input name="actual_time" required placeholder="Tempo reale" className="w-28" />
            <Button type="submit" size="sm" disabled={resolving}>
              Risolvi
            </Button>
          </>
        )}
      </ActionForm>
    </div>
  );
}
