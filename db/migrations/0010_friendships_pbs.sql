-- Mutual friendships (both users must accept) and verified personal bests.

-- ---------------------------------------------------------------------------
-- Friendships (user ↔ user), replacing one-way follows
-- ---------------------------------------------------------------------------

create table friendships (
  user_low uuid not null references users (id) on delete cascade,
  user_high uuid not null references users (id) on delete cascade,
  requested_by uuid not null references users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by = user_low or requested_by = user_high)
);

create index friendships_requested_idx on friendships (requested_by) where status = 'pending';

-- Existing follows become pending requests (the other person still has to accept).
insert into friendships (user_low, user_high, requested_by, status)
select least(f.user_id, a.user_id), greatest(f.user_id, a.user_id), f.user_id, 'pending'
  from follows f
  join athletes a on a.id = f.athlete_id
 where a.user_id is not null and a.user_id <> f.user_id
on conflict do nothing;

drop table follows;

-- ---------------------------------------------------------------------------
-- Personal bests: claimed with proof, verified by an admin
-- ---------------------------------------------------------------------------

create table pb_claims (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  distance_km numeric(6, 3) not null check (distance_km > 0),
  time_seconds integer not null check (time_seconds > 0),
  evidence_kind text not null check (evidence_kind in ('strava', 'photo', 'official')),
  evidence_url text,
  photo bytea,
  photo_type text,
  note text check (char_length(note) <= 280),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (evidence_kind = 'photo' and photo is not null and photo_type is not null)
    or (evidence_kind <> 'photo' and evidence_url is not null)
  )
);

create index pb_claims_pending_idx on pb_claims (status, created_at) where status = 'pending';
create unique index pb_claims_one_pending_idx on pb_claims (athlete_id, distance_km)
  where status = 'pending';

create table athlete_pbs (
  athlete_id uuid not null references athletes (id) on delete cascade,
  distance_km numeric(6, 3) not null check (distance_km > 0),
  time_seconds integer not null check (time_seconds > 0),
  claim_id uuid references pb_claims (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, distance_km)
);
