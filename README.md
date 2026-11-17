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
- [Supabase](https://supabase.com): Auth (magic link), Postgres con Row Level Security, Realtime
- Deploy consigliato: [Vercel](https://vercel.com)

## Setup

### 1. Supabase

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Apri **SQL Editor** ed esegui in ordine:
   - `supabase/migrations/0001_init.sql` (schema, funzioni di trading, permessi, realtime)
   - `supabase/seed.sql` (opzionale: gare e atleti di esempio)
3. In **Authentication > URL Configuration** imposta:
   - Site URL: `http://localhost:3000` (poi l'URL di produzione)
   - Redirect URLs: `http://localhost:3000/auth/callback` e `https://<tuo-dominio>/auth/callback`

In alternativa, con la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <ref>
supabase db push
```

### 2. Variabili d'ambiente

```bash
cp .env.example .env.local
```

e inserisci `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Project Settings > API).

### 3. Avvio in locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000), accedi con la tua email e poi diventa admin
eseguendo nel SQL Editor:

```sql
update profiles set is_admin = true where username = 'il-tuo-nickname';
```

Da `/admin` puoi creare gare, atleti e mercati, chiudere le giocate e risolvere i mercati.

### 4. Deploy su Vercel

1. Importa questo repository su [vercel.com/new](https://vercel.com/new).
2. Aggiungi le due variabili `NEXT_PUBLIC_SUPABASE_*` nelle Environment Variables.
3. Aggiungi l'URL di Vercel ai Redirect URLs di Supabase.

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
    login/, auth/          magic link Supabase
  actions/                 server actions (trade, admin)
  components/              UI (MarketCard, TradePanel, PriceChart, ...)
  lib/
    lmsr.ts                formule LMSR per l'anteprima lato client
    time.ts                parsing/formattazione tempi e generazione fasce
    supabase/              client browser/server e middleware sessione
supabase/
  migrations/0001_init.sql
  seed.sql
```

## Note sul modello

Le operazioni che toccano saldo e quote avvengono solo nelle funzioni Postgres
`buy_shares`, `sell_shares` e `resolve_market` (`security definer`), così il client non può
modificare saldi o prezzi direttamente.

- Prezzo: `p_i = exp(q_i / b) / Σ exp(q_j / b)`
- Quote ottenute spendendo `A` crediti: `x = b · ln(1 + (exp(A / b) − 1) / p_i)`
- Ricavo vendendo `x` quote: `−b · ln(1 − p_i + p_i · exp(−x / b))`

Il parametro `b` (liquidità) si sceglie per mercato: più è alto, meno i prezzi si muovono a ogni
giocata. Le probabilità iniziali delle fasce si possono impostare alla creazione del mercato.
