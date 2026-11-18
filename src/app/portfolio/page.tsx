import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { StravaCard } from "@/components/strava-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isStravaConfigured } from "@/lib/strava";
import { cn } from "@/lib/utils";
import { formatCents, formatCredits, formatDateTime } from "@/lib/format";

export const metadata = { title: "Portfolio · PolyRunner" };

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

export default async function PortfolioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/portfolio");

  const stravaEnabled = await isStravaConfigured();
  const [strava, positions, trades] = await Promise.all([
    stravaEnabled
      ? queryOne<{ display_name: string | null; athlete_name: string | null }>(
          `select coalesce(s.display_name, 'Strava athlete') as display_name,
                  (select a.name from athletes a where a.user_id = s.user_id) as athlete_name
             from strava_accounts s where s.user_id = $1`,
          [profile.id],
        )
      : null,
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
        <Avatar name={profile.username} url={profile.avatar_url} size={56} />
        <div>
          <h1 className="text-2xl font-semibold">{profile.username}</h1>
          <p className="text-sm text-muted-foreground">Your portfolio</p>
        </div>
      </div>

      {stravaEnabled && (
        <StravaCard connectedAs={strava?.display_name ?? null} athleteName={strava?.athlete_name ?? null} />
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Available balance" value={formatCredits(profile.balance)} />
        <Stat label="Positions value" value={formatCredits(positionsValue)} />
        <Stat label="Total" value={formatCredits(total)} />
        <Stat
          label="Profit / loss"
          value={`${totalPnl >= 0 ? "+" : ""}${formatCredits(totalPnl)}`}
          className={totalPnl >= 0 ? "text-yes" : "text-no"}
        />
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Open positions</h2>
        {open.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No open positions.{" "}
            <Link href="/" className="text-primary hover:underline">
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
