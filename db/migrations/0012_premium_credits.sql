-- Premium accounts, exact-time friend bets, bib EUR ledger, weekly km credits.

-- ---------------------------------------------------------------------------
-- Users: premium, lifetime credits, simulated EUR wallet
-- ---------------------------------------------------------------------------

alter table users
  add column if not exists is_premium boolean not null default false,
  add column if not exists lifetime_credits numeric(18, 6) not null default 1000,
  add column if not exists eur_balance numeric(12, 2) not null default 0;

-- Align lifetime with starting balance for existing users who never earned more.
update users set lifetime_credits = greatest(lifetime_credits, 1000);

alter table races
  add column if not exists bib_price_eur numeric(10, 2) not null default 0
  check (bib_price_eur >= 0);

-- LMSR (Pros / Yes-No) vs exact-time predictions (Friends finish-time).
alter table markets
  add column if not exists pricing text not null default 'lmsr'
  check (pricing in ('lmsr', 'exact_time'));

-- Friend exact-time markets have no LMSR outcomes; relax only via pricing flag.
-- Existing time markets stay lmsr.

create table if not exists bib_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  race_id uuid not null references races (id) on delete cascade,
  price_eur numeric(10, 2) not null check (price_eur > 0),
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  paid_at timestamptz not null default now(),
  refunded_at timestamptz,
  unique (user_id, race_id)
);

create index if not exists bib_entries_race_idx on bib_entries (race_id);
create index if not exists bib_entries_user_idx on bib_entries (user_id);

create table if not exists time_predictions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  predicted_seconds integer not null check (predicted_seconds > 0),
  stake numeric(18, 6) not null check (stake > 0),
  payout numeric(18, 6),
  created_at timestamptz not null default now(),
  unique (market_id, user_id)
);

create index if not exists time_predictions_market_idx on time_predictions (market_id);
create index if not exists time_predictions_user_idx on time_predictions (user_id);

create table if not exists credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in (
    'signup', 'trade', 'prediction_stake', 'prediction_payout',
    'athlete_bonus', 'weekly_km', 'premium_unlock'
  )),
  amount numeric(18, 6) not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx on credit_ledger (user_id, created_at desc);

create table if not exists weekly_km_awards (
  user_id uuid not null references users (id) on delete cascade,
  week_start date not null,
  km numeric(10, 3) not null check (km >= 0),
  credits numeric(18, 6) not null check (credits >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- Defaults (overridable in app_settings).
insert into app_settings (key, value) values
  ('premium_threshold', '5000'),
  ('prediction_max_error_seconds', '600'),
  ('prediction_max_multiplier', '2'),
  ('weekly_km_linear_cap', '40'),
  ('weekly_km_rate_linear', '10'),
  ('weekly_km_rate_extra', '5')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers: settings, credit grant, premium unlock
-- ---------------------------------------------------------------------------

create or replace function app_setting(p_key text, p_default text)
returns text
language sql
stable
as $$
  select coalesce((select value from app_settings where key = p_key), p_default);
$$;

create or replace function maybe_unlock_premium(p_user_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_threshold numeric;
  v_life numeric;
  v_was boolean;
begin
  v_threshold := app_setting('premium_threshold', '5000')::numeric;
  select is_premium, lifetime_credits into v_was, v_life from users where id = p_user_id for update;
  if not found then
    return false;
  end if;
  if v_was then
    return true;
  end if;
  if v_life >= v_threshold then
    update users set is_premium = true where id = p_user_id;
    insert into credit_ledger (user_id, kind, amount, meta)
    values (p_user_id, 'premium_unlock', 0, jsonb_build_object('threshold', v_threshold, 'lifetime', v_life));
    return true;
  end if;
  return false;
end;
$$;

create or replace function grant_credits(
  p_user_id uuid,
  p_amount numeric,
  p_kind text,
  p_meta jsonb default '{}'::jsonb,
  p_count_lifetime boolean default true
)
returns void
language plpgsql
as $$
begin
  if p_amount = 0 then
    return;
  end if;
  if p_amount > 0 and p_count_lifetime then
    update users
      set balance = balance + p_amount,
          lifetime_credits = lifetime_credits + p_amount
      where id = p_user_id;
  elsif p_amount > 0 then
    update users set balance = balance + p_amount where id = p_user_id;
  else
    update users set balance = balance + p_amount where id = p_user_id and balance + p_amount >= 0;
    if not found then
      raise exception 'Insufficient balance';
    end if;
  end if;

  insert into credit_ledger (user_id, kind, amount, meta)
  values (p_user_id, p_kind, p_amount, coalesce(p_meta, '{}'::jsonb));

  perform maybe_unlock_premium(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Exact-time market creation (Friends finish-time, no LMSR brackets)
-- ---------------------------------------------------------------------------

create or replace function create_exact_time_market(
  p_race_id uuid,
  p_athlete_id uuid,
  p_closes_at timestamptz default null
)
returns uuid
language plpgsql
as $$
declare
  v_market_id uuid;
begin
  insert into markets (race_id, athlete_id, liquidity_b, closes_at, kind, pricing)
  values (
    p_race_id,
    p_athlete_id,
    1,
    coalesce(p_closes_at, (select starts_at from races where id = p_race_id)),
    'time',
    'exact_time'
  )
  returning id into v_market_id;
  return v_market_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Place a prediction (stake + predicted finish time)
-- ---------------------------------------------------------------------------

create or replace function place_time_prediction(
  p_user_id uuid,
  p_market_id uuid,
  p_predicted_seconds integer,
  p_stake numeric
)
returns uuid
language plpgsql
as $$
declare
  v_market markets%rowtype;
  v_id uuid;
begin
  if p_predicted_seconds is null or p_predicted_seconds <= 0 then
    raise exception 'Invalid predicted time';
  end if;
  if p_stake is null or p_stake <= 0 then
    raise exception 'Stake must be positive';
  end if;

  select * into v_market from markets where id = p_market_id for update;
  if not found then
    raise exception 'Market not found';
  end if;
  if v_market.pricing <> 'exact_time' then
    raise exception 'This market uses share trading';
  end if;
  if v_market.status <> 'open' then
    raise exception 'Market is not open';
  end if;
  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'Trading has closed';
  end if;

  if exists (select 1 from time_predictions where market_id = p_market_id and user_id = p_user_id) then
    raise exception 'You already placed a prediction on this market';
  end if;

  perform grant_credits(
    p_user_id,
    -p_stake,
    'prediction_stake',
    jsonb_build_object('market_id', p_market_id),
    false
  );

  insert into time_predictions (market_id, user_id, predicted_seconds, stake)
  values (p_market_id, p_user_id, p_predicted_seconds, p_stake)
  returning id into v_id;

  update markets set volume = volume + p_stake where id = p_market_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settle exact-time predictions: payout = stake * mult * max(0, 1 - |err|/T)
-- ---------------------------------------------------------------------------

create or replace function settle_time_predictions(p_market_id uuid, p_actual_time_seconds integer)
returns void
language plpgsql
as $$
declare
  v_t numeric;
  v_mult numeric;
  v_pred record;
  v_payout numeric;
  v_err numeric;
begin
  v_t := app_setting('prediction_max_error_seconds', '600')::numeric;
  v_mult := app_setting('prediction_max_multiplier', '2')::numeric;
  if v_t <= 0 then
    v_t := 600;
  end if;

  for v_pred in
    select * from time_predictions where market_id = p_market_id and payout is null for update
  loop
    v_err := abs(v_pred.predicted_seconds - p_actual_time_seconds);
    v_payout := round((v_pred.stake * v_mult * greatest(0, 1 - v_err / v_t))::numeric, 6);

    update time_predictions set payout = v_payout where id = v_pred.id;

    if v_payout > 0 then
      perform grant_credits(
        v_pred.user_id,
        v_payout,
        'prediction_payout',
        jsonb_build_object(
          'market_id', p_market_id,
          'predicted', v_pred.predicted_seconds,
          'actual', p_actual_time_seconds,
          'error', v_err
        ),
        true
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bib registration (simulated paid) + automatic EUR refund on PB + premium
-- ---------------------------------------------------------------------------

create or replace function register_bib(p_user_id uuid, p_race_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_price numeric;
  v_id uuid;
begin
  select bib_price_eur into v_price from races where id = p_race_id;
  if not found then
    raise exception 'Race not found';
  end if;
  if v_price is null or v_price <= 0 then
    raise exception 'This race has no bib fee';
  end if;

  insert into bib_entries (user_id, race_id, price_eur, status)
  values (p_user_id, p_race_id, v_price, 'paid')
  on conflict (user_id, race_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from bib_entries where user_id = p_user_id and race_id = p_race_id;
    raise exception 'Already registered for this race';
  end if;
  return v_id;
end;
$$;

create or replace function refund_bib_if_eligible(p_market_id uuid)
returns table (refunded_eur numeric, user_id uuid)
language plpgsql
as $$
declare
  v_m record;
  v_entry bib_entries%rowtype;
begin
  select m.id, m.athlete_id, m.actual_time_seconds as t, m.race_id,
         a.user_id, u.is_premium, ar.kind as reward_kind
    into v_m
    from markets m
    join athletes a on a.id = m.athlete_id
    join users u on u.id = a.user_id
    left join athlete_rewards ar on ar.market_id = m.id
   where m.id = p_market_id and m.kind = 'time' and m.status = 'resolved';

  if not found or v_m.user_id is null then
    return;
  end if;
  if not v_m.is_premium then
    return;
  end if;
  if v_m.reward_kind is distinct from 'personal_best' then
    return;
  end if;

  select * into v_entry
    from bib_entries
   where user_id = v_m.user_id and race_id = v_m.race_id and status = 'paid'
   for update;
  if not found then
    return;
  end if;

  update bib_entries
    set status = 'refunded', refunded_at = now()
    where id = v_entry.id;

  update users
    set eur_balance = eur_balance + v_entry.price_eur
    where id = v_m.user_id;

  refunded_eur := v_entry.price_eur;
  user_id := v_m.user_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Weekly km credits: linear to cap, then reduced rate
-- ---------------------------------------------------------------------------

create or replace function award_weekly_km(
  p_user_id uuid,
  p_week_start date,
  p_km numeric
)
returns numeric
language plpgsql
as $$
declare
  v_cap numeric;
  v_rate1 numeric;
  v_rate2 numeric;
  v_credits numeric;
  v_linear numeric;
  v_extra numeric;
  v_prev numeric;
  v_delta numeric;
begin
  if p_km is null or p_km < 0 then
    raise exception 'Invalid km';
  end if;

  v_cap := app_setting('weekly_km_linear_cap', '40')::numeric;
  v_rate1 := app_setting('weekly_km_rate_linear', '10')::numeric;
  v_rate2 := app_setting('weekly_km_rate_extra', '5')::numeric;

  v_linear := least(p_km, v_cap);
  v_extra := greatest(p_km - v_cap, 0);
  v_credits := round((v_linear * v_rate1 + v_extra * v_rate2)::numeric, 6);

  insert into weekly_km_awards (user_id, week_start, km, credits)
  values (p_user_id, p_week_start, p_km, v_credits)
  on conflict (user_id, week_start) do update
    set km = excluded.km,
        credits = excluded.credits;

  -- Award only the delta vs credits already granted for this week.
  select coalesce(sum(amount), 0) into v_prev
    from credit_ledger
   where user_id = p_user_id
     and kind = 'weekly_km'
     and (meta ->> 'week_start') = p_week_start::text;

  v_delta := v_credits - v_prev;
  if v_delta > 0 then
    perform grant_credits(
      p_user_id,
      v_delta,
      'weekly_km',
      jsonb_build_object('week_start', p_week_start, 'km', p_km, 'total_credits', v_credits)
    );
  end if;

  return v_credits;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve: support exact_time (no brackets) + settle predictions
-- ---------------------------------------------------------------------------

create or replace function settle_market(p_market_id uuid, p_winner uuid, p_actual_time_seconds integer)
returns void
language plpgsql
as $$
declare
  v_race_id uuid;
  v_pricing text;
begin
  select pricing into v_pricing from markets where id = p_market_id;

  if v_pricing = 'lmsr' and p_winner is not null then
    update users u
      set balance = u.balance + pos.shares
      from positions pos
      where pos.user_id = u.id and pos.outcome_id = p_winner and pos.shares > 0;
  end if;

  update markets
    set status = 'resolved',
        actual_time_seconds = p_actual_time_seconds,
        winning_outcome_id = p_winner
    where id = p_market_id
    returning race_id into v_race_id;

  if v_pricing = 'lmsr' then
    insert into price_snapshots (market_id, outcome_id, price)
    select p_market_id, id, case when id = p_winner then 1.0 else 0.0 end
    from outcomes where market_id = p_market_id;
  end if;

  if v_pricing = 'exact_time' and p_actual_time_seconds is not null then
    perform settle_time_predictions(p_market_id, p_actual_time_seconds);
  end if;

  update races r
    set status = 'resolved'
    where r.id = v_race_id
      and not exists (
        select 1 from markets m where m.race_id = r.id and m.status <> 'resolved'
      );
end;
$$;

create or replace function resolve_market(p_market_id uuid, p_actual_time_seconds integer)
returns uuid
language plpgsql
as $$
declare
  v_market markets%rowtype;
  v_winner uuid;
begin
  if p_actual_time_seconds is null or p_actual_time_seconds <= 0 then
    raise exception 'Invalid time';
  end if;

  select * into v_market from markets where id = p_market_id for update;
  if not found then
    raise exception 'Market not found';
  end if;
  if v_market.status = 'resolved' then
    raise exception 'Market already resolved';
  end if;
  if v_market.kind <> 'time' then
    raise exception 'This market is resolved by choosing an outcome';
  end if;

  if v_market.pricing = 'exact_time' then
    perform settle_market(p_market_id, null, p_actual_time_seconds);
    return null;
  end if;

  select id into v_winner from outcomes
    where market_id = p_market_id
      and (min_seconds is null or p_actual_time_seconds >= min_seconds)
      and (max_seconds is null or p_actual_time_seconds < max_seconds)
    order by sort_order
    limit 1;
  if v_winner is null then
    raise exception 'No bracket contains this time';
  end if;

  perform settle_market(p_market_id, v_winner, p_actual_time_seconds);
  return v_winner;
end;
$$;

-- ---------------------------------------------------------------------------
-- Athlete bonus: also bump lifetime_credits + trigger bib refund on PB+premium
-- Return type changed (added bib_refund_eur) → must DROP first (42P13).
-- ---------------------------------------------------------------------------

drop function if exists award_athlete_bonus(uuid);

create or replace function award_athlete_bonus(p_market_id uuid)
returns table (
  reward_kind text,
  reward_amount numeric,
  bib_refund_eur numeric
)
language plpgsql
as $$
declare
  v_m record;
  v_pb integer;
  v_last integer;
  v_kind text;
  v_amount numeric;
  v_ref integer;
  v_refund numeric;
begin
  select m.id, m.athlete_id, m.actual_time_seconds as t, a.user_id, a.personal_best_seconds,
         r.distance_km, r.starts_at
    into v_m
    from markets m
    join athletes a on a.id = m.athlete_id
    join races r on r.id = m.race_id
   where m.id = p_market_id and m.kind = 'time' and m.status = 'resolved';

  if not found or v_m.user_id is null or v_m.t is null then
    return;
  end if;

  select min(m2.actual_time_seconds) into v_pb
    from markets m2 join races r2 on r2.id = m2.race_id
   where m2.athlete_id = v_m.athlete_id and m2.kind = 'time' and m2.status = 'resolved'
     and m2.id <> v_m.id and r2.distance_km = v_m.distance_km and r2.starts_at < v_m.starts_at;
  v_pb := least(v_pb, v_m.personal_best_seconds);

  select m2.actual_time_seconds into v_last
    from markets m2 join races r2 on r2.id = m2.race_id
   where m2.athlete_id = v_m.athlete_id and m2.kind = 'time' and m2.status = 'resolved'
     and m2.id <> v_m.id and r2.distance_km = v_m.distance_km and r2.starts_at < v_m.starts_at
   order by r2.starts_at desc
   limit 1;

  if v_pb is not null and v_m.t < v_pb then
    v_kind := 'personal_best'; v_amount := 200; v_ref := v_pb;
  elsif v_last is not null and v_m.t <= v_last + 60 then
    v_kind := 'steady'; v_amount := 50; v_ref := v_last;
  end if;

  if v_kind is not null then
    insert into athlete_rewards (market_id, user_id, kind, amount, time_seconds, reference_seconds)
    values (p_market_id, v_m.user_id, v_kind, v_amount, v_m.t, v_ref)
    on conflict (market_id) do nothing;

    if found then
      perform grant_credits(
        v_m.user_id,
        v_amount,
        'athlete_bonus',
        jsonb_build_object('market_id', p_market_id, 'kind', v_kind)
      );
      if v_kind = 'personal_best' then
        update athletes
          set personal_best_seconds = v_m.t
          where id = v_m.athlete_id
            and (personal_best_seconds is null or personal_best_seconds > v_m.t);
      end if;
    end if;
  end if;

  select r.refunded_eur into v_refund from refund_bib_if_eligible(p_market_id) r;

  if v_kind is null and v_refund is null then
    return;
  end if;

  reward_kind := v_kind;
  reward_amount := v_amount;
  bib_refund_eur := v_refund;
  return next;
end;
$$;
