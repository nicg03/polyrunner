import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { cn } from "@/lib/utils";
import { formatCents, formatCredits, formatDateTime } from "@/lib/format";

export const metadata = { title: "Portfolio · PolyRunner" };

const STARTING_BALANCE = 1000;

interface PositionRow {
  outcome_id: string;
  market_id: string;
  shares: number;
  cost_basis: number;
  price: number;
  outcome: { label: string } | null;
  market: {
    status: string;
    winning_outcome_id: string | null;
    athlete: { name: string } | null;
    race: { name: string } | null;
  } | null;
}

interface TradeRow {
  id: number;
  side: "buy" | "sell";
  shares: number;
  cost: number;
  created_at: string;
  market_id: string;
  outcome: { label: string } | null;
  market: { athlete: { name: string } | null } | null;
}

export default async function PortfolioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/portfolio");

  const [positions, trades] = await Promise.all([
    query<PositionRow>(
      `select p.outcome_id, p.market_id, p.shares, p.cost_basis,
              jsonb_build_object('label', o.label) as outcome,
              jsonb_build_object(
                'status', m.status,
                'winning_outcome_id', m.winning_outcome_id,
                'athlete', jsonb_build_object('name', a.name),
                'race', jsonb_build_object('name', r.name)
              ) as market,
              op.price
         from positions p
         join outcomes o on o.id = p.outcome_id
         join markets m on m.id = p.market_id
         join athletes a on a.id = m.athlete_id
         join races r on r.id = m.race_id
         join outcome_prices op on op.outcome_id = p.outcome_id
        where p.user_id = $1 and p.shares > 0
        order by p.updated_at desc`,
      [profile.id],
    ),
    query<TradeRow>(
      `select t.id, t.side, t.shares, t.cost, t.created_at, t.market_id,
              jsonb_build_object('label', o.label) as outcome,
              jsonb_build_object('athlete', jsonb_build_object('name', a.name)) as market
         from trades t
         join outcomes o on o.id = t.outcome_id
         join markets m on m.id = t.market_id
         join athletes a on a.id = m.athlete_id
        where t.user_id = $1
        order by t.created_at desc limit 50`,
      [profile.id],
    ),
  ]);

  const rows = positions.map((p) => {
    const shares = Number(p.shares);
    const costBasis = Number(p.cost_basis);
    const price = Number(p.price);
    const resolved = p.market?.status === "resolved";
    const won = resolved && p.market?.winning_outcome_id === p.outcome_id;
    const value = shares * price;
    return { ...p, shares, costBasis, price, resolved, won, value, pnl: value - costBasis };
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
          <p className="text-sm text-muted-foreground">Il tuo portfolio</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Saldo disponibile" value={formatCredits(profile.balance)} />
        <Stat label="Valore posizioni" value={formatCredits(positionsValue)} />
        <Stat label="Totale" value={formatCredits(total)} />
        <Stat
          label="Profitto / perdita"
          value={`${totalPnl >= 0 ? "+" : ""}${formatCredits(totalPnl)}`}
          className={totalPnl >= 0 ? "text-yes" : "text-no"}
        />
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Posizioni aperte</h2>
        {open.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nessuna posizione aperta. <Link href="/" className="text-primary hover:underline">Esplora i mercati</Link>
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Mercato</TableHead>
                <TableHead>Fascia</TableHead>
                <TableHead className="text-right">Quote</TableHead>
                <TableHead className="text-right">Prezzo medio</TableHead>
                <TableHead className="text-right">Prezzo attuale</TableHead>
                <TableHead className="text-right">Valore</TableHead>
                <TableHead className="pr-4 text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.map((r) => (
                <TableRow key={r.outcome_id}>
                  <TableCell className="pl-4">
                    <Link href={`/markets/${r.market_id}`} className="font-medium hover:underline">
                      {r.market?.athlete?.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{r.market?.race?.name}</p>
                  </TableCell>
                  <TableCell>{r.outcome?.label}</TableCell>
                  <TableCell className="text-right">{r.shares.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{formatCents(r.costBasis / r.shares)}</TableCell>
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
          <h2 className="border-b px-4 py-3 font-medium">Mercati risolti</h2>
          <Table>
            <TableBody>
              {settled.map((r) => (
                <TableRow key={r.outcome_id}>
                  <TableCell className="pl-4">
                    <Link href={`/markets/${r.market_id}`} className="font-medium hover:underline">
                      {r.market?.athlete?.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {r.outcome?.label}</span>
                  </TableCell>
                  <TableCell className="text-right">{r.shares.toFixed(2)} quote</TableCell>
                  <TableCell className={cn("pr-4 text-right font-medium", r.won ? "text-yes" : "text-no")}>
                    {r.won ? `Vinto +${formatCredits(r.shares)}` : `Perso -${formatCredits(r.costBasis)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Storico giocate</h2>
        {trades.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nessuna giocata.</p>
        ) : (
          <Table>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4">
                    <span className={t.side === "buy" ? "text-yes" : "text-no"}>
                      {t.side === "buy" ? "Compra" : "Vendi"}
                    </span>{" "}
                    <Link href={`/markets/${t.market_id}`} className="hover:underline">
                      {t.market?.athlete?.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">· {t.outcome?.label}</span>
                  </TableCell>
                  <TableCell className="text-right">{Number(t.shares).toFixed(2)} quote</TableCell>
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
