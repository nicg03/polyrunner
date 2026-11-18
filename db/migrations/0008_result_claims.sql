-- PolyRunner: results verified without Strava.
-- After the race anyone can submit the finish time of a finish-time market with a proof
-- (Strava activity link, photo of the watch, official results page). An admin checks the
-- proof and accepts the claim to resolve the market.

create table result_claims (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
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

create index result_claims_market_idx on result_claims (market_id, created_at);
create unique index result_claims_one_pending_idx on result_claims (market_id, user_id)
  where status = 'pending';

alter table markets add column result_claim_id uuid references result_claims (id) on delete set null;
