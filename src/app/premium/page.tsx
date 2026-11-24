import Link from "next/link";
import { redirect } from "next/navigation";
import { PremiumProgress } from "@/components/premium-progress";
import { StravaCard } from "@/components/strava-card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getAppSetting, weekStartUtc } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
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
          `select coalesce(s.display_name, 'Strava athlete') as display_name,
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
          Earn virtual credits → unlock Premium → register a race bib → beat your personal best →
          get the bib refunded by PolyRunner (EUR wallet ledger).
        </p>
      </div>

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
        <Step n={1} title="Earn credits">
          Bet with friends, collect athlete bonuses, and sync weekly Strava km (
          {formatCredits(10)}/km up to 40 km, then {formatCredits(5)}/km).
        </Step>
        <Step n={2} title={`Reach ${formatCredits(threshold)} lifetime`}>
          Premium unlocks automatically and stays on forever once you hit the threshold.
        </Step>
        <Step n={3} title="Pick a race and register the bib">
          Search upcoming races with a bib fee. Confirm the (simulated) bib so PolyRunner can
          refund it later.{" "}
          <Link href="/races?bib=1" className="text-primary hover:underline">
            Browse races →
          </Link>
        </Step>
        <Step n={4} title="Run a personal best">
          After the race is resolved with a PB, Premium runners get an automatic EUR refund — no
          admin step. Track PBs on{" "}
          <Link href="/profile" className="text-primary hover:underline">
            Profile
          </Link>
          .
        </Step>
      </ol>

      {(bibCount?.n ?? 0) > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-400/10 px-4 py-3 text-sm">
          You have {bibCount!.n} paid bib registration{bibCount!.n === 1 ? "" : "s"} waiting for a
          Premium PB refund.{" "}
          <Link href="/races?bib=1" className="font-medium text-primary hover:underline">
            View races
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
          Find a race for PB refund
        </Link>
        <Link href="/wallet" className={buttonVariants({ variant: "outline" })}>
          Open wallet
        </Link>
        <Link href="/profile" className={buttonVariants({ variant: "ghost" })}>
          Profile & PBs
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
