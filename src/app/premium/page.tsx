import Link from "next/link";
import { redirect } from "next/navigation";
import { stubPremiumCheckout } from "@/actions/commerce";
import { PremiumProgress } from "@/components/premium-progress";
import { StravaCard } from "@/components/strava-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getAppSetting, weekStartUtc } from "@/lib/credits";
import { queryOne } from "@/lib/db";
import { formatCredits } from "@/lib/format";
import { isStravaConfigured } from "@/lib/strava";

export const metadata = { title: "Premium · PolyRunner" };

export default async function PremiumPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/premium");

  const stravaEnabled = await isStravaConfigured();
  const weekStart = weekStartUtc();
  const [thresholdRaw, weekly, strava, bibCount] = await Promise.all([
    getAppSetting("premium_threshold", "5000"),
    queryOne<{ km: number; credits: number }>(
      "select km, credits from weekly_km_awards where user_id = $1 and week_start = $2::date",
      [profile.id, weekStart],
    ).catch(() => null),
    stravaEnabled
      ? queryOne<{ display_name: string | null; athlete_name: string | null }>(
          `select coalesce(s.display_name, 'Atleta Strava') as display_name,
                  (select a.name from athletes a where a.user_id = s.user_id) as athlete_name
             from strava_accounts s where s.user_id = $1`,
          [profile.id],
        )
      : null,
    queryOne<{ n: number }>(
      "select count(*)::int as n from bib_entries where user_id = $1 and status = 'paid'",
      [profile.id],
    ).catch(() => ({ n: 0 })),
  ]);

  const threshold = Number(thresholdRaw) || 5000;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Premium</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guadagna crediti virtuali oppure sblocca con pagamento (stub). Poi registra un pettorale,
          batti il PB e ricevi il rimborso sul wallet EUR.
        </p>
      </div>

      <ul className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
        <li>
          <p className="font-medium">Rimborso pettorale</p>
          <p className="mt-1 text-muted-foreground">
            Con un PB su una gara con pettorale registrato, la quota torna sul wallet EUR in
            automatico.
          </p>
        </li>
        <li>
          <p className="font-medium">PB verificati</p>
          <p className="mt-1 text-muted-foreground">
            I personal best dopo la risoluzione della gara contano per il rimborso Premium.
          </p>
        </li>
        <li>
          <p className="font-medium">Per sempre</p>
          <p className="mt-1 text-muted-foreground">
            Raggiungi {formatCredits(threshold)} lifetime o paga 4,99 € (stub): Premium non scade.
          </p>
        </li>
      </ul>

      {!profile.is_premium && (
        <form
          action={async () => {
            "use server";
            await stubPremiumCheckout();
          }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <p className="mb-2 text-sm">
            Sblocca Premium a 4,99 € (pagamento simulato — nessun addebito reale).
          </p>
          <Button type="submit" size="sm">
            Paga con carta (stub)
          </Button>
        </form>
      )}

      <PremiumProgress
        isPremium={profile.is_premium}
        lifetimeCredits={Number(profile.lifetime_credits)}
        threshold={threshold}
        balance={Number(profile.balance)}
        eurBalance={Number(profile.eur_balance)}
        weeklyKm={weekly ? Number(weekly.km) : null}
        weeklyCredits={weekly ? Number(weekly.credits) : null}
      />

      <ol className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm">
        <Step n={1} title="Guadagna crediti">
          Scommetti con gli amici, raccogli bonus atleta e sincronizza i km settimanali Strava (
          {formatCredits(10)}/km fino a 40 km, poi {formatCredits(5)}/km).
        </Step>
        <Step n={2} title={`Raggiungi ${formatCredits(threshold)} lifetime`}>
          Premium si sblocca in automatico e resta attivo per sempre una volta raggiunta la soglia.
        </Step>
        <Step n={3} title="Scegli una gara e registra il pettorale">
          Cerca gare in arrivo con quota pettorale. Conferma il pettorale (simulato) così PolyRunner
          può rimborsarlo dopo.{" "}
          <Link href="/races?bib=1" className="text-primary hover:underline">
            Sfoglia le gare →
          </Link>
        </Step>
        <Step n={4} title="Corri un personal best">
          Dopo la risoluzione della gara con PB, i runner Premium ricevono un rimborso EUR
          automatico — senza passaggio admin. Segui i PB su{" "}
          <Link href="/profile" className="text-primary hover:underline">
            Profilo
          </Link>
          .
        </Step>
      </ol>

      {(bibCount?.n ?? 0) > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-400/10 px-4 py-3 text-sm">
          Hai {bibCount!.n} pettorale{bibCount!.n === 1 ? "" : "i"} registrat
          {bibCount!.n === 1 ? "o" : "i"} in attesa di un rimborso Premium per PB.{" "}
          <Link href="/races?bib=1" className="font-medium text-primary hover:underline">
            Vedi le gare
          </Link>
        </p>
      )}

      <StravaCard
        connectedAs={strava?.display_name ?? null}
        athleteName={strava?.athlete_name ?? null}
        configured={stravaEnabled}
        isAdmin={profile.is_admin}
        weeklyKm={
          weekly ? { km: Number(weekly.km), credits: Number(weekly.credits) } : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/races?bib=1" className={buttonVariants()}>
          Trova una gara per il rimborso PB
        </Link>
        <Link href="/wallet" className={buttonVariants({ variant: "outline" })}>
          Apri il wallet
        </Link>
        <Link href="/profile" className={buttonVariants({ variant: "ghost" })}>
          Profilo e PB
        </Link>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
