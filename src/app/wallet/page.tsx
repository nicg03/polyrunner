import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { PremiumProgress } from "@/components/premium-progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile } from "@/lib/auth";
import { getAppSetting, weekStartUtc } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
import { cn } from "@/lib/utils";
import { formatCents, formatCredits, formatDateTime, formatEur } from "@/lib/format";
import { formatTime } from "@/lib/time";

export const metadata = { title: "Wallet · PolyRunner" };

const STARTING_BALANCE = 1000;

const MARKET_TITLE_SQL = `
  case when m.kind = 'custom' then m.question else 'What time will ' || a.name || ' run?' end
`;

interface PositionRow {
  outcome_id: string;
  market_id: string;
  shares: number;
  cost_basis: number;
  price: number;
  outcome_label: string;
  title: string;
  race_name: string;
  status: string;
  winning_outcome_id: string | null;
}

interface TradeRow {
  id: number;
  side: "buy" | "sell";
  shares: number;
  cost: number;
  created_at: string;
  market_id: string;
  outcome_label: string;
  title: string;
}

interface PredictionRow {
  id: string;
  market_id: string;
  predicted_seconds: number;
  stake: number;
  payout: number | null;
  title: string;
  status: string;
}

export default async function WalletPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/wallet");

  const weekStart = weekStartUtc();
  const [positions, trades, predictions, thresholdRaw, weekly] = await Promise.all([
    query<PositionRow>(
      `select p.outcome_id, p.market_id, p.shares, p.cost_basis, op.price,
              o.label as outcome_label, ${MARKET_TITLE_SQL} as title, r.name as race_name,
              m.status, m.winning_outcome_id
         from positions p
         join outcomes o on o.id = p.outcome_id
         join markets m on m.id = p.market_id
         left join athletes a on a.id = m.athlete_id
         join races r on r.id = m.race_id
         join outcome_prices op on op.outcome_id = p.outcome_id
        where p.user_id = $1 and p.shares > 0
        order by p.updated_at desc`,
      [profile.id],
    ),
    query<TradeRow>(
      `select t.id, t.side, t.shares, t.cost, t.created_at, t.market_id,
              o.label as outcome_label, ${MARKET_TITLE_SQL} as title
         from trades t
         join outcomes o on o.id = t.outcome_id
         join markets m on m.id = t.market_id
         left join athletes a on a.id = m.athlete_id
        where t.user_id = $1
        order by t.created_at desc limit 50`,
      [profile.id],
    ),
    query<PredictionRow>(
      `select tp.id, tp.market_id, tp.predicted_seconds, tp.stake, tp.payout,
              ${MARKET_TITLE_SQL} as title, m.status
         from time_predictions tp
         join markets m on m.id = tp.market_id
         left join athletes a on a.id = m.athlete_id
        where tp.user_id = $1
        order by tp.created_at desc`,
      [profile.id],
    ).catch(() => [] as PredictionRow[]),
    getAppSetting("premium_threshold", "5000"),
    queryOne<{ km: number; credits: number }>(
      "select km, credits from weekly_km_awards where user_id = $1 and week_start = $2::date",
      [profile.id, weekStart],
    ).catch(() => null),
  ]);

  const rows = positions.map((p) => {
    const resolved = p.status === "resolved";
    const won = resolved && p.winning_outcome_id === p.outcome_id;
    const value = p.shares * p.price;
    return { ...p, resolved, won, value, pnl: value - p.cost_basis };
  });

  const open = rows.filter((r) => !r.resolved);
  const settled = rows.filter((r) => r.resolved);
  const positionsValue = open.reduce((s, r) => s + r.value, 0);
  const total = Number(profile.balance) + positionsValue;
  const totalPnl = total - STARTING_BALANCE;

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center gap-4">
        <Link href="/profile">
          <Avatar name={profile.username} url={profile.avatar_url} size={56} />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Wallet
            {profile.is_premium && (
              <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-500">
                PREMIUM
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            @{profile.username} · virtual credits only (not transferable / not cash) ·{" "}
            <Link href="/profile" className="text-primary hover:underline">
              Profile
            </Link>
          </p>
        </div>
      </div>

      <PremiumProgress
        isPremium={profile.is_premium}
        lifetimeCredits={Number(profile.lifetime_credits)}
        threshold={Number(thresholdRaw) || 5000}
        balance={Number(profile.balance)}
        eurBalance={Number(profile.eur_balance)}
        weeklyKm={weekly ? Number(weekly.km) : null}
        weeklyCredits={weekly ? Number(weekly.credits) : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Positions value" value={formatCredits(positionsValue)} />
        <Stat label="Total mark" value={formatCredits(total)} />
        <Stat
          label="Profit / loss"
          value={`${totalPnl >= 0 ? "+" : ""}${formatCredits(totalPnl)}`}
          className={totalPnl >= 0 ? "text-yes" : "text-no"}
        />
        <Stat label="EUR wallet (refunds)" value={formatEur(Number(profile.eur_balance))} />
      </div>

      {predictions.filter((p) => p.status !== "resolved").length > 0 && (
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-medium">Open time predictions</h2>
          <Table>
            <TableBody>
              {predictions
                .filter((p) => p.status !== "resolved")
                .map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-96 pl-4">
                      <Link href={`/markets/${p.market_id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        · {formatTime(Number(p.predicted_seconds))}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {formatCredits(Number(p.stake))}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Open positions</h2>
        {open.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No open positions.{" "}
            <Link href="/markets" className="text-primary hover:underline">
              Browse markets
            </Link>
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Market</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Avg. price</TableHead>
                <TableHead className="text-right">Current price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="pr-4 text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.map((r) => (
                <TableRow key={r.outcome_id}>
                  <TableCell className="max-w-72 pl-4">
                    <Link href={`/markets/${r.market_id}`} className="block truncate font-medium hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{r.race_name}</p>
                  </TableCell>
                  <TableCell>{r.outcome_label}</TableCell>
                  <TableCell className="text-right">{r.shares.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{formatCents(r.cost_basis / r.shares)}</TableCell>
                  <TableCell className="text-right">{formatCents(r.price)}</TableCell>
                  <TableCell className="text-right">{formatCredits(r.value)}</TableCell>
                  <TableCell className={cn("pr-4 text-right", r.pnl >= 0 ? "text-yes" : "text-no")}>
                    {r.pnl >= 0 ? "+" : ""}
                    {formatCredits(r.pnl)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {settled.length > 0 && (
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 font-medium">Resolved markets</h2>
          <Table>
            <TableBody>
              {settled.map((r) => (
                <TableRow key={r.outcome_id}>
                  <TableCell className="max-w-96 pl-4">
                    <Link href={`/markets/${r.market_id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {r.outcome_label}</span>
                  </TableCell>
                  <TableCell className="text-right">{r.shares.toFixed(2)} shares</TableCell>
                  <TableCell className={cn("pr-4 text-right font-medium", r.won ? "text-yes" : "text-no")}>
                    {r.won ? `Won +${formatCredits(r.shares)}` : `Lost -${formatCredits(r.cost_basis)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Trade history</h2>
        {trades.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No trades yet.</p>
        ) : (
          <Table>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-96 pl-4">
                    <span className={t.side === "buy" ? "text-yes" : "text-no"}>
                      {t.side === "buy" ? "Buy" : "Sell"}
                    </span>{" "}
                    <Link href={`/markets/${t.market_id}`} className="hover:underline">
                      {t.title}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {t.outcome_label}</span>
                  </TableCell>
                  <TableCell className="text-right">{Number(t.shares).toFixed(2)} shares</TableCell>
                  <TableCell className="text-right">{formatCredits(t.cost)}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">
                    {formatDateTime(t.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", className)}>{value}</p>
    </div>
  );
}
