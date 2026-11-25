"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { generateWeeklyMarkets, resolveWeeklyMarkets } from "@/actions/weekly";
import { createPrize, importOfficialResult, updateRaceCommerce } from "@/actions/commerce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminViralPanel({
  kFactor,
  referrals,
  markets,
  races,
}: {
  kFactor: number;
  referrals: number;
  markets: number;
  races: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok?: string; error?: string } | null>) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (res?.ok) toast.success(res.ok);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-medium">Metriche virali</h2>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">K-factor</dt>
            <dd className="text-lg font-semibold">{kFactor.toFixed(2)}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">Referral</dt>
            <dd className="text-lg font-semibold">{referrals}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <dt className="text-xs text-muted-foreground">Mercati</dt>
            <dd className="text-lg font-semibold">{markets}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => generateWeeklyMarkets())}
          >
            Genera mercati settimanali
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => resolveWeeklyMarkets())}
          >
            Risolvi settimanali
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-medium">Commercio gara / premi</h2>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => updateRaceCommerce(null, fd));
          }}
        >
          <select
            name="race_id"
            className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
            required
          >
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Input name="organizer_sponsor" placeholder="Sponsor organizzatore" />
          <Input name="pb_refund_budget_eur" placeholder="Budget rimborso PB €" />
          <Input name="affiliate_url" placeholder="URL affiliazione pettorale" />
          <Button type="submit" size="sm" disabled={pending}>
            Salva commercio
          </Button>
        </form>
        <form
          className="mt-4 flex flex-col gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => createPrize(null, fd));
          }}
        >
          <Input name="sponsor_name" placeholder="Sponsor premio" required />
          <Input name="title" placeholder="Titolo premio (scarpe, pettorale…)" required />
          <Input name="description" placeholder="Descrizione" />
          <select
            name="race_id"
            className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
          >
            <option value="">— gara opzionale —</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Crea premio fisico
          </Button>
        </form>
        <form
          className="mt-4 flex flex-col gap-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const marketId = String(fd.get("market_id") ?? "");
            const bib = String(fd.get("bib") ?? "");
            run(() => importOfficialResult(marketId, bib));
          }}
        >
          <p className="text-xs text-muted-foreground">
            Classifica ufficiale (stub): pettorale DEMO-mmss es. DEMO-9520
          </p>
          <Input name="market_id" placeholder="UUID mercato" required />
          <Input name="bib" placeholder="Pettorale" required />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Importa risultato ufficiale
          </Button>
        </form>
      </section>
    </div>
  );
}
