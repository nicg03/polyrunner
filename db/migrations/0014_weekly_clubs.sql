-- Phase 2: activity sources, weekly markets, clubs, return bonus tracking.

create table if not exists activity_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  provider text not null check (provider in ('mock', 'garmin', 'polar', 'coros', 'suunto', 'healthkit')),
  external_id text,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  last_sync_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists weekly_activity_stats (
  user_id uuid not null references users (id) on delete cascade,
  week_start date not null,
  runs_count integer not null default 0,
  distance_km numeric(10, 3) not null default 0,
  source text not null default 'mock',
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table if not exists user_activity_prefs (
  user_id uuid primary key references users (id) on delete cascade,
  weekly_markets_opt_in boolean not null default false,
  target_runs_per_week integer not null default 3,
  target_km_per_week numeric(10, 3) not null default 30,
  last_activity_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Clubs / squads
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists club_members (
  club_id uuid not null references clubs (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on club_members (user_id);

alter table markets
  add column if not exists club_id uuid references clubs (id) on delete set null,
  add column if not exists week_start date,
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Club challenges may have no single athlete subject.
alter table markets alter column athlete_id drop not null;
alter table markets drop constraint if exists markets_race_id_athlete_id_key;
create unique index if not exists markets_race_athlete_unique
  on markets (race_id, athlete_id) where athlete_id is not null;

create table if not exists return_bonus_awards (
  user_id uuid not null references users (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  gap_days integer not null,
  amount numeric(18, 6) not null,
  primary key (user_id, awarded_at)
);
