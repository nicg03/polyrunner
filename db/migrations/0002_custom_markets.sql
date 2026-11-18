-- Custom Yes/No markets created by admins, outcome-based resolution, English error messages.

alter table markets add column kind text not null default 'time' check (kind in ('time', 'custom'));
alter table markets add column question text;
alter table markets alter column athlete_id drop not null;
alter table markets drop constraint markets_race_id_athlete_id_key;
create unique index markets_time_athlete_idx on markets (race_id, athlete_id) where kind = 'time';
alter table markets add constraint markets_kind_fields_check check (
  (kind = 'time' and athlete_id is not null) or (kind = 'custom' and question is not null)
);

-- ---------------------------------------------------------------------------
-- Market creation
-- ---------------------------------------------------------------------------

create or replace function create_market(
  p_race_id uuid,
  p_athlete_id uuid,
  p_liquidity_b numeric,
  p_closes_at timestamptz,
  p_outcomes jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_market_id uuid;
  v_count integer;
  v_prob_sum double precision;
  v_item jsonb;
  v_idx integer := 0;
  v_prob double precision;
  v_b numeric := coalesce(p_liquidity_b, 100);
begin
  v_count := jsonb_array_length(p_outcomes);
  if v_count < 2 then
    raise exception 'At least 2 time brackets are required';
  end if;

  select coalesce(sum(nullif(x ->> 'prob', '')::float8), 0)
    into v_prob_sum
    from jsonb_array_elements(p_outcomes) x;

  insert into markets (race_id, athlete_id, liquidity_b, closes_at, kind)
  values (
    p_race_id,
    p_athlete_id,
    v_b,
    coalesce(p_closes_at, (select starts_at from races where id = p_race_id)),
    'time'
  )
  returning id into v_market_id;

  for v_item in select * from jsonb_array_elements(p_outcomes) loop
    v_prob := nullif(v_item ->> 'prob', '')::float8;
    if v_prob_sum > 0 and v_prob is not null and v_prob > 0 then
      v_prob := v_prob / v_prob_sum;
    else
      v_prob := 1.0 / v_count;
    end if;

    insert into outcomes (market_id, label, min_seconds, max_seconds, q_shares, sort_order)
    values (
      v_market_id,
      v_item ->> 'label',
      nullif(v_item ->> 'min_seconds', '')::integer,
      nullif(v_item ->> 'max_seconds', '')::integer,
      round((v_b::float8 * ln(v_prob))::numeric, 6),
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  perform snapshot_market(v_market_id);
  return v_market_id;
end;
$$;

-- Yes/No market. p_yes_prob is the initial probability of "Yes" (0-1, default 0.5).
create or replace function create_custom_market(
  p_race_id uuid,
  p_athlete_id uuid,
  p_question text,
  p_liquidity_b numeric,
  p_closes_at timestamptz,
  p_yes_prob double precision
)
returns uuid
language plpgsql
as $$
declare
  v_market_id uuid;
  v_b numeric := coalesce(p_liquidity_b, 100);
  v_yes double precision := coalesce(p_yes_prob, 0.5);
begin
  if p_question is null or char_length(trim(p_question)) < 5 then
    raise exception 'The question is too short';
  end if;
  if v_yes <= 0.01 or v_yes >= 0.99 then
    raise exception 'Initial probability must be between 1%% and 99%%';
  end if;

  insert into markets (race_id, athlete_id, liquidity_b, closes_at, kind, question)
  values (
    p_race_id,
    p_athlete_id,
    v_b,
    coalesce(p_closes_at, (select starts_at from races where id = p_race_id)),
    'custom',
    trim(p_question)
  )
  returning id into v_market_id;

  insert into outcomes (market_id, label, q_shares, sort_order) values
    (v_market_id, 'Yes', round((v_b::float8 * ln(v_yes))::numeric, 6), 0),
    (v_market_id, 'No', round((v_b::float8 * ln(1 - v_yes))::numeric, 6), 1);

  perform snapshot_market(v_market_id);
  return v_market_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trading
-- ---------------------------------------------------------------------------

create or replace function buy_shares(p_user_id uuid, p_outcome_id uuid, p_amount numeric)
returns json
language plpgsql
as $$
declare
  v_market_id uuid;
  v_market markets%rowtype;
  v_balance numeric;
  v_b double precision;
  v_price double precision;
  v_shares numeric;
  v_price_after double precision;
begin
  if p_user_id is null then
    raise exception 'You need to log in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  select market_id into v_market_id from outcomes where id = p_outcome_id;
  if v_market_id is null then
    raise exception 'Outcome not found';
  end if;

  select * into v_market from markets where id = v_market_id for update;
  if v_market.status <> 'open' or (v_market.closes_at is not null and v_market.closes_at <= now()) then
    raise exception 'This market is closed';
  end if;

  v_b := v_market.liquidity_b::float8;
  if p_amount::float8 / v_b > 50 then
    raise exception 'Amount too large for this market''s liquidity';
  end if;

  select balance into v_balance from users where id = p_user_id for update;
  if v_balance is null then
    raise exception 'User not found';
  end if;
  if v_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  select mp.price into v_price from market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;
  v_shares := round((v_b * ln(1 + (exp(p_amount::float8 / v_b) - 1) / v_price))::numeric, 6);
  if v_shares <= 0 then
    raise exception 'Amount too small';
  end if;

  update outcomes set q_shares = q_shares + v_shares where id = p_outcome_id;
  update users set balance = balance - p_amount where id = p_user_id;
  update markets set volume = volume + p_amount where id = v_market_id;

  insert into positions (user_id, outcome_id, market_id, shares, cost_basis)
  values (p_user_id, p_outcome_id, v_market_id, v_shares, p_amount)
  on conflict (user_id, outcome_id) do update
    set shares = positions.shares + excluded.shares,
        cost_basis = positions.cost_basis + excluded.cost_basis,
        updated_at = now();

  select mp.price into v_price_after from market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;

  insert into trades (user_id, market_id, outcome_id, side, shares, cost, price_after)
  values (p_user_id, v_market_id, p_outcome_id, 'buy', v_shares, p_amount, v_price_after);

  perform snapshot_market(v_market_id);

  return json_build_object(
    'shares', v_shares,
    'cost', p_amount,
    'avg_price', p_amount / v_shares,
    'price_after', v_price_after
  );
end;
$$;

create or replace function sell_shares(p_user_id uuid, p_outcome_id uuid, p_shares numeric)
returns json
language plpgsql
as $$
declare
  v_market_id uuid;
  v_market markets%rowtype;
  v_position positions%rowtype;
  v_b double precision;
  v_price double precision;
  v_proceeds numeric;
  v_price_after double precision;
begin
  if p_user_id is null then
    raise exception 'You need to log in';
  end if;
  if p_shares is null or p_shares <= 0 then
    raise exception 'Invalid number of shares';
  end if;

  select market_id into v_market_id from outcomes where id = p_outcome_id;
  if v_market_id is null then
    raise exception 'Outcome not found';
  end if;

  select * into v_market from markets where id = v_market_id for update;
  if v_market.status <> 'open' or (v_market.closes_at is not null and v_market.closes_at <= now()) then
    raise exception 'This market is closed';
  end if;

  select * into v_position from positions
    where user_id = p_user_id and outcome_id = p_outcome_id for update;
  if not found or v_position.shares < p_shares then
    raise exception 'You don''t have enough shares';
  end if;

  v_b := v_market.liquidity_b::float8;
  select mp.price into v_price from market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;
  v_proceeds := round((-v_b * ln(1 - v_price + v_price * exp(-p_shares::float8 / v_b)))::numeric, 6);
  if v_proceeds < 0 then
    v_proceeds := 0;
  end if;

  update outcomes set q_shares = q_shares - p_shares where id = p_outcome_id;
  update users set balance = balance + v_proceeds where id = p_user_id;
  update markets set volume = volume + v_proceeds where id = v_market_id;

  update positions
    set cost_basis = case when shares = p_shares then 0 else cost_basis * (shares - p_shares) / shares end,
        shares = shares - p_shares,
        updated_at = now()
    where user_id = p_user_id and outcome_id = p_outcome_id;

  select mp.price into v_price_after from market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;

  insert into trades (user_id, market_id, outcome_id, side, shares, cost, price_after)
  values (p_user_id, v_market_id, p_outcome_id, 'sell', p_shares, v_proceeds, v_price_after);

  perform snapshot_market(v_market_id);

  return json_build_object(
    'shares', p_shares,
    'proceeds', v_proceeds,
    'avg_price', v_proceeds / p_shares,
    'price_after', v_price_after
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolution: the winning outcome pays 1 credit per share.
-- ---------------------------------------------------------------------------

create or replace function settle_market(p_market_id uuid, p_winner uuid, p_actual_time_seconds integer)
returns void
language plpgsql
as $$
declare
  v_race_id uuid;
begin
  update users u
    set balance = u.balance + pos.shares
    from positions pos
    where pos.user_id = u.id and pos.outcome_id = p_winner and pos.shares > 0;

  update markets
    set status = 'resolved',
        actual_time_seconds = p_actual_time_seconds,
        winning_outcome_id = p_winner
    where id = p_market_id
    returning race_id into v_race_id;

  insert into price_snapshots (market_id, outcome_id, price)
  select p_market_id, id, case when id = p_winner then 1.0 else 0.0 end
  from outcomes where market_id = p_market_id;

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

create or replace function resolve_market_outcome(p_market_id uuid, p_outcome_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_market markets%rowtype;
begin
  select * into v_market from markets where id = p_market_id for update;
  if not found then
    raise exception 'Market not found';
  end if;
  if v_market.status = 'resolved' then
    raise exception 'Market already resolved';
  end if;
  if not exists (select 1 from outcomes where id = p_outcome_id and market_id = p_market_id) then
    raise exception 'Outcome does not belong to this market';
  end if;

  perform settle_market(p_market_id, p_outcome_id, null);
  return p_outcome_id;
end;
$$;

-- Demo data from the first seed, translated.
update athletes set bio = 'Weekend marathoner, PB 3:30:00' where bio = 'Maratoneta della domenica, PB 3:30:00';
update athletes set bio = 'Former middle-distance runner, PB 3:10:00' where bio = 'Ex mezzofondista, PB 3:10:00';
update athletes set bio = 'First marathon, plenty of confidence' where bio = 'Prima maratona, tanta fiducia';
update athletes set bio = 'Half marathon specialist, PB 1:35:00' where bio = 'Specialista della mezza, PB 1:35:00';
update athletes set bio = 'Fast over 10K, PB 43:00' where bio = 'Veloce sui 10K, PB 43:00';
update races set location = 'Sempione Park' where location = 'Parco Sempione';
update races set location = 'Milan' where location = 'Milano';
update races set name = '10K in the Park' where name = '10K del Parco';
