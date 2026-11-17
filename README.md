# PolyRunner

Mercati di previsione in stile Polymarket sui tempi di gara dei tuoi amici runner.
Nato per gioco: si usano solo **crediti virtuali**.

## Come funziona

- Ogni **mercato** è un atleta in una gara (es. "Che tempo farà Marco alla Milano Marathon?").
- Il mercato è diviso in **fasce di tempo** (`< 3:15:00`, `3:15:00 - 3:30:00`, ...). Il prezzo di
  ogni fascia va da 0 a 100 centesimi ed è la probabilità implicita.
- Ogni utente parte con **1000 crediti**. Compri quote della fascia in cui credi: se alla fine è
  quella giusta, ogni quota vale 1 credito, altrimenti 0. Puoi rivendere prima della chiusura.
- I prezzi sono calcolati da un market maker automatico **LMSR**
  (Logarithmic Market Scoring Rule): c'è sempre liquidità anche con pochi giocatori, e i prezzi
  sommano sempre al 100%.
- Dopo la gara un admin inserisce il tempo ufficiale e il mercato viene risolto automaticamente.

## Stack

- [Next.js 15](https://nextjs.org) (App Router, Server Actions), Tailwind CSS, shadcn/ui, Recharts
- PostgreSQL via [`pg`](https://node-postgres.com), login con nickname e password (sessioni nel database)
- Deploy su [Railway](https://railway.com) (servizio web + Postgres), configurato in `.railway/railway.ts`

## Account e admin

Ci si registra con nickname e password da `/login`. **Il primo utente registrato diventa admin**;
per promuoverne altri:

```sql
update users set is_admin = true where username = 'nickname';
```

Da `/admin` si creano gare, atleti e mercati, si chiudono le giocate e si risolvono i mercati.

## Sviluppo in locale

Serve un Postgres raggiungibile (es. `brew install postgresql` oppure Docker).

```bash
cp .env.example .env.local   # imposta DATABASE_URL
npm install
npm run db:migrate           # crea lo schema (e i dati demo se SEED_DEMO=true)
npm run dev
```

## Deploy su Railway

Il progetto Railway `polyrunner` ha due servizi:

- **web**: collegato a questo repository, ogni push su `main` fa un nuovo deploy. Prima di ogni
  deploy esegue `node scripts/migrate.mjs`, che applica le migration nuove in `db/migrations`.
- **Postgres**: database gestito, raggiungibile solo dalla rete privata del progetto.

Variabili del servizio web (definite in `.railway/railway.ts`):

| Variabile | Valore |
| --- | --- |
| `DATABASE_URL` | riferimento a `Postgres.DATABASE_URL` |
| `SEED_DEMO` | `true`: carica gare e atleti di esempio se il database è vuoto |

Per modificare l'infrastruttura: modifica `.railway/railway.ts`, poi `railway config plan` e
`railway config apply`.

## Struttura

```
src/
  app/
    page.tsx               griglia dei mercati
    races/[id]/            tutti gli atleti di una gara
    markets/[id]/          grafico, fasce, pannello Compra/Vendi, attività
    portfolio/             posizioni, P&L, storico
    leaderboard/           classifica
    admin/                 gestione gare, atleti, mercati e risoluzione
    login/                 registrazione e accesso
  actions/                 server actions (auth, trade, admin)
  components/              UI (MarketCard, TradePanel, PriceChart, ...)
  lib/
    db.ts                  pool Postgres
    auth.ts                password (scrypt) e sessioni
    lmsr.ts                formule LMSR per l'anteprima lato client
    time.ts                parsing/formattazione tempi e generazione fasce
db/
  migrations/0001_init.sql schema e funzioni di trading
  seed.sql                 dati di esempio
scripts/migrate.mjs        runner delle migration
.railway/railway.ts        infrastruttura Railway
```

## Note sul modello

Saldo, quote e prezzi si modificano solo dentro le funzioni Postgres `buy_shares`,
`sell_shares` e `resolve_market`, in una transazione con lock sul mercato.

- Prezzo: `p_i = exp(q_i / b) / Σ exp(q_j / b)`
- Quote ottenute spendendo `A` crediti: `x = b · ln(1 + (exp(A / b) − 1) / p_i)`
- Ricavo vendendo `x` quote: `−b · ln(1 − p_i + p_i · exp(−x / b))`

Il parametro `b` (liquidità) si sceglie per mercato: più è alto, meno i prezzi si muovono a ogni
giocata. Le probabilità iniziali delle fasce si possono impostare alla creazione del mercato.
