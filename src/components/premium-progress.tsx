import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCredits, formatEur } from "@/lib/format";

export function PremiumProgress({
  isPremium,
  lifetimeCredits,
  threshold,
  balance,
  eurBalance,
  weeklyKm,
  weeklyCredits,
  className,
}: {
  isPremium: boolean;
  lifetimeCredits: number;
  threshold: number;
  balance: number;
  eurBalance: number;
  weeklyKm: number | null;
  weeklyCredits: number | null;
  className?: string;
}) {
  const life = Number(lifetimeCredits);
  const goal = Math.max(Number(threshold) || 5000, 1);
  const pct = Math.min(100, Math.round((life / goal) * 100));
  const remaining = Math.max(0, goal - life);

  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {isPremium ? "Sei Premium" : "Sblocca Premium"}
            {isPremium && (
              <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
                PREMIUM
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPremium
              ? "Fai un personal best su una gara con pettorale registrato e PolyRunner ti rimborsa automaticamente la quota sul wallet EUR."
              : `Guadagna ${formatCredits(goal)} crediti virtuali lifetime per sbloccare Premium. I crediti non sono trasferibili né convertibili in denaro.`}
          </p>
        </div>
        <Link href="/races?bib=1" className={buttonVariants({ size: "sm" })}>
          Trova gare per un PB
        </Link>
      </div>

      {!isPremium && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Guadagnati lifetime: <b className="text-foreground">{formatCredits(life)}</b>
            </span>
            <span>
              {pct}% · mancano {formatCredits(remaining)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label="Crediti disponibili" value={formatCredits(balance)} />
        <Stat
          label="Questa settimana (km Strava)"
          value={
            weeklyKm != null
              ? `${weeklyKm} km → ${formatCredits(weeklyCredits ?? 0)}`
              : "Sincronizza Strava dal Profilo"
          }
        />
        <Stat label="Wallet rimborsi EUR" value={formatEur(Number(eurBalance))} />
      </dl>

      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <li className="rounded-lg border bg-muted/30 px-3 py-2">
          <b className="text-foreground">Km settimanali</b> — 10 crediti/km fino a 40 km, poi 5/km.
        </li>
        <li className="rounded-lg border bg-muted/30 px-3 py-2">
          <b className="text-foreground">Vantaggio Premium</b> — rimborso automatico del pettorale
          sul personal best (ledger EUR simulato).
        </li>
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
