# PolyRunner

Prediction markets on your running friends' races.
Just for fun: betting runs on **virtual credits** (not transferable, not convertible to money).

## How it works

Each race can have two kinds of markets:

- **Friend finish-time markets**: one per athlete per race. Friends stake credits on an **exact
  finish time**; payout shrinks with the absolute error (no odds / brackets shown). Max return is
  2× the stake when the guess is exact (configurable).
- **Pro finish-time markets**: time brackets with an LMSR market maker (admin-created Pros).
- **Yes/No markets**: free-form questions (LMSR shares), optionally tied to an athlete.

Markets are grouped in two sections:

- **Friends**: athletes who are PolyRunner users. Click **"Join as a runner"** (Profile) or connect
  Strava to appear in search. Other users find you on `/friends` by name or username and send a
  request; **both must accept**. Then either of you can create a bet from `/create` (Yourself or
  Other friend). The leaderboard is limited to you and your accepted friends. Each user can create
  up to 10 bets a day.
- **Profile** (`/profile`): personal bests with proof (Strava / photo / official results), verified
  by an admin.
- **Wallet** (`/wallet`): balances, open positions, predictions and trade history.
- **Stake**: each bet can be in **credits** or **beers** (same wallet: 1 beer = 1 credit; beer is the
  social label so friends can settle a round in real life).
- **Pros**: athletes created by the admin with the "Pro" section (elite runners, race winners...),
  resolved by hand with the official result.

### Credits, Premium, bibs

- Every user starts with **1,000 virtual credits**. Lifetime credits unlock **Premium** at 5,000
  (sticky). Weekly Strava km award credits (10/km up to 40 km, then 5/km).
- Credits are **not transferable** between users and **not convertible to money**.
- Races can have a simulated **bib price (EUR)**. Registering records a paid bib. If a **Premium**
  runner hits a **personal best**, PolyRunner **automatically refunds** the bib into their EUR
  wallet ledger (no admin step; Stripe can plug in later).

## Verifying results

Finish-time results don't depend on Strava. Once the race has started, any logged-in user can
open the market and **submit the finish time with a proof**: a link to the Strava activity, a
photo of the watch (stored in the database, max 5 MB, shrunk in the browser), or a link to the
official results page. Runners see a reminder for each race waiting for a result on their
profile.

Pending results show up under the market in `/admin`. The admin opens the proof and clicks
**Accept** (the market settles with that time and the proof is shown publicly on the market page)
or **Reject** (the submitter is told and can send a new one). Photos of pending or rejected
results are only visible to admins and to whoever submitted them.

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

## Strava (optional)

Strava is a shortcut on top of the submitted results above. Runners can connect Strava from their
profile page. An admin links each athlete to the user who runs as them (`/admin` → Strava links).
When that user records a run that starts within 1 hour
before / 8 hours after the race start and covers 95–110% of the race distance, it shows up under
the market as a proposed result (elapsed time, distance, link to the activity). The admin accepts
it to resolve the market, or dismisses it and enters the official time by hand. "Check Strava"
looks the activity up on demand if the webhook missed it.

Friends sign in with **"Continue with Strava"** on the login page: no password, the account is
created from their Strava profile and they land in the Friends section.

Setup, all from the website: open `/admin` → **Strava setup** and follow the steps. It shows the
values to paste in [strava.com/settings/api](https://www.strava.com/settings/api); then paste the
Client ID and Client Secret back. The site checks them with Strava, stores them in the database
(`app_settings`) and registers the activity webhook.

`STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` env vars still work and take precedence;
`scripts/strava-subscribe.mjs` registers the webhook from the command line in that case.

New Strava apps can only connect their owner until Strava approves a higher athlete capacity
(request it from the app settings page).

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
| `APP_URL` | public URL, used for the Strava OAuth redirect |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | optional: otherwise set from `/admin` → Strava setup |

To change the infrastructure: edit `.railway/railway.ts`, then run `railway config plan` and
`railway config apply`.

## Structure

```
src/
  app/
    page.tsx               market grid: All / Friends / Pros, race and bet type filters
    create/                create a bet on a Strava-connected friend
    races/[id]/            all markets for a race
    markets/[id]/          chart, outcomes, Buy/Sell panel, activity
    wallet/                balances, positions, P&L, history
    profile/               runner status, personal bests, Strava
    friends/               search, requests, mutual friends
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
    0003_strava.sql        Strava accounts and proposed results
    0004_friends_pros.sql  athlete sections and user-created markets
    0005_app_settings.sql  settings editable from the admin page
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
