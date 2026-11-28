import Link from "next/link";
import { Trophy, UserPlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SetupNotice } from "@/components/setup-notice";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { isDatabaseConfigured, query } from "@/lib/db";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";

export const metadata = { title: "Classifica · PolyRunner" };
export const dynamic = "force-dynamic";

const STARTING_BALANCE = 1000;
const MEDALS = ["#f2c94c", "#c0c7d0", "#d08b4c"];

export default async function LeaderboardPage() {
  if (!isDatabaseConfigured) return <SetupNotice />;

  const profile = await getCurrentProfile();
  const rows = profile
    ? await query<LeaderboardRow>(
        `select l.* from leaderboard l
          where l.id = $1
             or exists (
               select 1 from friendships f
                where f.status = 'accepted'
                  and ((f.user_low = $1 and f.user_high = l.id)
                    or (f.user_high = $1 and f.user_low = l.id))
             )
          order by l.total_value desc
          limit 100`,
        [profile.id],
      )
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <div className="flex items-center gap-3">
        <Trophy className="size-7 text-[#f2c94c]" />
        <div>
          <h1 className="text-2xl font-semibold">Classifica</h1>
          <p className="text-sm text-muted-foreground">
            {profile
              ? "Solo tu e gli amici che avete accettato. Saldo + valore delle posizioni aperte."
              : "Accedi per vedere come ti posizioni tra gli amici."}
          </p>
        </div>
      </div>

      {!profile ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
          <p className="text-muted-foreground">La classifica è privata per ogni cerchia di amici.</p>
          <Link href="/login?next=/leaderboard" className={cn(buttonVariants(), "mt-4")}>
            Accedi
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {rows.length <= 1 && (
            <p className="border-b px-4 py-3 text-sm text-muted-foreground">
              Aggiungi amici per avere qualcuno con cui competere.{" "}
              <Link href="/friends" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <UserPlus className="size-3.5" /> Trova amici
              </Link>
            </p>
          )}
          {rows.map((r, i) => {
            const pnl = Number(r.total_value) - STARTING_BALANCE;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-4 border-b px-4 py-3 last:border-b-0",
                  r.id === profile.id && "bg-primary/10",
                )}
              >
                <span
                  className="w-6 text-center font-semibold"
                  style={{ color: MEDALS[i] ?? "var(--muted-foreground)" }}
                >
                  {i + 1}
                </span>
                <Avatar name={r.username} url={r.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.username}
                    {r.id === profile.id ? " (tu)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saldo {formatCredits(r.balance)} · Posizioni {formatCredits(r.positions_value)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCredits(r.total_value)}</p>
                  <p className={cn("text-xs", pnl >= 0 ? "text-yes" : "text-no")}>
                    {pnl >= 0 ? "+" : ""}
                    {((pnl / STARTING_BALANCE) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
