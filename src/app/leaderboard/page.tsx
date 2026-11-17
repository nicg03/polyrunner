import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SetupNotice } from "@/components/setup-notice";
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

  const [profile, rows] = await Promise.all([
    getCurrentProfile(),
    query<LeaderboardRow>("select * from leaderboard order by total_value desc limit 100"),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <div className="flex items-center gap-3">
        <Trophy className="size-7 text-[#f2c94c]" />
        <div>
          <h1 className="text-2xl font-semibold">Classifica</h1>
          <p className="text-sm text-muted-foreground">
            Saldo + valore attuale delle posizioni aperte. Tutti partono da {STARTING_BALANCE} crediti.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ancora nessun giocatore.</p>
        )}
        {rows.map((r, i) => {
          const pnl = Number(r.total_value) - STARTING_BALANCE;
          return (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-4 border-b px-4 py-3 last:border-b-0",
                r.id === profile?.id && "bg-primary/10",
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
                <p className="truncate font-medium">{r.username}</p>
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
    </div>
  );
}
