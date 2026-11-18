-- PolyRunner: Strava integration
-- Users connect their Strava account; activities recorded on race day become result proposals
-- that an admin accepts to resolve finish-time markets.

create table strava_accounts (
  user_id uuid primary key references users (id) on delete cascade,
  strava_athlete_id bigint not null unique,
  display_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now()
);

create unique index athletes_user_idx on athletes (user_id) where user_id is not null;

create table strava_results (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets (id) on delete cascade,
  activity_id bigint not null,
  activity_name text,
  elapsed_seconds integer not null check (elapsed_seconds > 0),
  moving_seconds integer,
  distance_m numeric(10, 1) not null,
  start_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (market_id, activity_id)
);

create index strava_results_pending_idx on strava_results (market_id) where status = 'pending';

alter table markets add column strava_activity_id bigint;
