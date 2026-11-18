-- PolyRunner: each user picks the runners they want to see in the Friends section.
-- Following needs no approval, like following someone on Strava.

create table follows (
  user_id uuid not null references users (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, athlete_id)
);

create index follows_athlete_idx on follows (athlete_id);
