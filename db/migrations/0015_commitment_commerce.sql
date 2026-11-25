-- Phase 3: Commitment Pot, commerce, prizes, affiliate, result disputes.

create table if not exists commitment_pots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  week_start date not null,
  target_km numeric(10, 3) not null check (target_km > 0),
  amount_eur numeric(10, 2) not null check (amount_eur >= 5 and amount_eur <= 50),
  charity_name text not null,
  status text not null default 'active'
    check (status in ('active', 'succeeded', 'failed', 'suspended', 'voided')),
  jolly_used boolean not null default false,
  payment_ref text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, week_start)
);

create table if not exists commitment_jolly (
  user_id uuid not null references users (id) on delete cascade,
  month_start date not null,
  used_count integer not null default 0 check (used_count >= 0 and used_count <= 2),
  primary key (user_id, month_start)
);

-- Commerce on races
alter table races
  add column if not exists organizer_sponsor text,
  add column if not exists pb_refund_budget_eur numeric(12, 2) default 0,
  add column if not exists affiliate_url text;

create table if not exists affiliate_clicks (
  id bigint generated always as identity primary key,
  race_id uuid not null references races (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  race_id uuid references races (id) on delete cascade,
  market_id uuid references markets (id) on delete set null,
  sponsor_name text not null,
  title text not null,
  description text,
  awarded_to uuid references users (id) on delete set null,
  awarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Social dispute / contest of a result claim
alter table result_claims
  add column if not exists contested_by uuid references users (id) on delete set null,
  add column if not exists contested_at timestamptz,
  add column if not exists contest_note text;

create table if not exists premium_checkout_stubs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  amount_eur numeric(10, 2) not null default 4.99,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

-- K-factor helper view (invites credited per market creators — approximate)
create or replace view admin_kfactor_stats as
select
  (select count(*)::numeric from referrals where credited_at is not null) as credited_referrals,
  (select count(*)::numeric from markets where created_by is not null) as markets_created,
  case
    when (select count(*) from markets where created_by is not null) = 0 then 0
    else (select count(*)::numeric from referrals where credited_at is not null)
         / (select count(*)::numeric from markets where created_by is not null)
  end as k_factor;
