import { redirect } from "next/navigation";
import {
  claimCommitmentJolly,
  resolveCommitmentPots,
  suggestedTargetForUser,
  suspendCommitment,
} from "@/actions/commitment";
import { listCharities } from "@/lib/charities";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { weekStartUtc } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
import { formatEur } from "@/lib/format";
import type { CommitmentPot } from "@/lib/types";
import { CommitmentForm } from "./commitment-form";

export const metadata = { title: "Commitment Pot · PolyRunner" };

export default async function CommitmentPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/commitment");

  const week = weekStartUtc();
  const [suggested, active, history, jolly] = await Promise.all([
    suggestedTargetForUser(profile.id),
    queryOne<CommitmentPot>(
      `select * from commitment_pots where user_id = $1 and week_start = $2::date`,
      [profile.id, week],
    ),
    query<CommitmentPot>(
      `select * from commitment_pots where user_id = $1 order by week_start desc limit 8`,
      [profile.id],
    ),
    queryOne<{ used_count: number }>(
      `select used_count from commitment_jolly
        where user_id = $1 and month_start = date_trunc('month', now())::date`,
      [profile.id],
    ),
  ]);

  const charities = listCharities();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
          Funzione avanzata · facoltativa
        </p>
        <h1 className="text-2xl font-semibold">Commitment Pot</h1>
        <p className="text-sm text-muted-foreground">
          Blocchi 5–50 € (preautorizzazione simulata). Se raggiungi i km, l&apos;importo non viene
          addebitato. Se fallisci, va in donazione a una ONLUS — la piattaforma non incassa mai.
          Separato dai crediti e dai mercati.
        </p>
      </div>

      {active?.status === "active" ? (
        <div className="rounded-xl border bg-card p-4">
          <p className="font-medium">
            Pot attivo: {Number(active.target_km)} km · {formatEur(Number(active.amount_eur))} →{" "}
            {active.charity_name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Jolly usati questo mese: {jolly?.used_count ?? 0}/2
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form
              action={async () => {
                "use server";
                await claimCommitmentJolly();
              }}
            >
              <Button type="submit" size="sm" variant="outline">
                Usa giorno jolly
              </Button>
            </form>
            <form
              action={async () => {
                "use server";
                await suspendCommitment();
              }}
            >
              <Button type="submit" size="sm" variant="destructive">
                Sospendi (infortunio)
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <CommitmentForm suggested={suggested} charities={charities} />
      )}

      <form
        action={async () => {
          "use server";
          await resolveCommitmentPots();
        }}
      >
        <Button type="submit" variant="outline" size="sm">
          Risolvi pot scaduti
        </Button>
      </form>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Cronologia</h2>
        {history.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nessun pot ancora.</p>
        )}
        {history.map((p) => (
          <div key={p.id} className="flex justify-between border-b px-4 py-3 text-sm last:border-b-0">
            <span>
              {p.week_start} · {Number(p.target_km)} km
            </span>
            <span className="text-muted-foreground">
              {p.status} · {formatEur(Number(p.amount_eur))}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
