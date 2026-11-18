# PolyRunner

Polymarket-style prediction markets on your running friends' races.
Just for fun: everything runs on **virtual credits**.

## How it works

Each race can have two kinds of markets:

- **Finish-time markets**: one per athlete per race (e.g. "What time will Marco run?"). The market
  is split into **time brackets** (`< 3:15:00`, `3:15:00 - 3:30:00`, ...).
- **Yes/No markets**: free-form questions created by the admin (e.g. "Will Marco stop to walk at
  any point?", "Will Luca finish ahead of Giulia?"), optionally tied to an athlete.

Every outcome trades between 0 and 100 cents, and the price is its implied probability.

- Every user starts with **1,000 credits**. Buy shares of the outcome you believe in: if it wins,
  each share pays 1 credit, otherwise 0. You can sell back any time before trading closes.
- Prices come from an automated **LMSR** market maker (Logarithmic Market Scoring Rule): there is
  always liquidity even with few players, and prices always add up to 100%.
- After the race an admin enters the official time (finish-time markets) or picks the winning
  outcome (Yes/No markets), and payouts happen automatically.

## Stack

- [Next.js 15](https://nextjs.org) (App Router, Server Actions), Tailwind CSS, shadcn/ui, Recharts
- PostgreSQL via [`pg`](https://node-postgres.com), username/password login (sessions stored in the database)
- Deployed on [Railway](https://railway.com) (web service + Postgres), configured in `.railway/railway.ts`

## Accounts and admin

Sign up with a username and password at `/login`. **The first user to sign up becomes admin**;
to promote others:

```sql
update users set is_admin = true where username = 'username';
```

From `/admin` you create races, athletes, finish-time markets and Yes/No markets, close trading
and resolve markets.

## Local development

You need a reachable Postgres (e.g. `brew install postgresql` or Docker).

```bash
cp .env.example .env.local   # set DATABASE_URL
npm install
npm run db:migrate           # creates the schema (and demo data if SEED_DEMO=true)
npm run dev
```

## Deploying on Railway

The Railway project `polyrunner` has two services:

- **web**: linked to this repository, every push to `main` triggers a deploy. Before each deploy
  it runs `node scripts/migrate.mjs`, which applies any new migrations in `db/migrations`.
- **Postgres**: managed database, reachable only from the project's private network.

Web service variables (defined in `.railway/railway.ts`):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | reference to `Postgres.DATABASE_URL` |
| `SEED_DEMO` | `true`: loads demo races and athletes if the database is empty |

To change the infrastructure: edit `.railway/railway.ts`, then run `railway config plan` and
`railway config apply`.

## Structure

```
src/
  app/
    page.tsx               market grid with race / bet type filters
    races/[id]/            all markets for a race
    markets/[id]/          chart, outcomes, Buy/Sell panel, activity
    portfolio/             positions, P&L, history
    leaderboard/           rankings
    admin/                 races, athletes, markets and resolution
    login/                 sign up and log in
  actions/                 server actions (auth, trade, admin)
  components/              UI (MarketCard, TradePanel, PriceChart, ...)
  lib/
    db.ts                  Postgres pool
    auth.ts                passwords (scrypt) and sessions
    lmsr.ts                LMSR formulas for the client-side preview
    time.ts                time parsing/formatting and bracket generation
db/
  migrations/
    0001_init.sql          schema and trading functions
    0002_custom_markets.sql Yes/No markets and outcome-based resolution
  seed.sql                 demo data
scripts/migrate.mjs        migration runner
.railway/railway.ts        Railway infrastructure
```

## Model notes

Balances, shares and prices only change inside the Postgres functions `buy_shares`,
`sell_shares`, `resolve_market` and `resolve_market_outcome`, in a transaction that locks the market.

- Price: `p_i = exp(q_i / b) / Σ exp(q_j / b)`
- Shares bought by spending `A` credits: `x = b · ln(1 + (exp(A / b) − 1) / p_i)`
- Proceeds from selling `x` shares: `−b · ln(1 − p_i + p_i · exp(−x / b))`

The liquidity parameter `b` is set per market: the higher it is, the less prices move on each
trade. Initial probabilities (per bracket, or the starting Yes %) can be set when creating a market.
