-- PolyRunner: schema iniziale
-- Mercati di previsione sui tempi di gara con market maker LMSR e crediti virtuali.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 2 and 24),
  password_hash text not null,
  avatar_url text,
  balance numeric(18, 6) not null default 1000 check (balance >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index users_username_lower_idx on users (lower(username));

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_idx on sessions (user_id);

create table races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  distance_km numeric(6, 3) not null check (distance_km > 0),
  location text,
  image_url text,
  status text not null default 'upcoming' check (status in ('upcoming', 'closed', 'resolved')),
  created_at timestamptz not null default now()
);

create table athletes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  personal_best_seconds integer check (personal_best_seconds > 0),
  bio text,
  user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table markets (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references races (id) on delete cascade,
  athlete_id uuid not null references athletes (id) on delete cascade,
  liquidity_b numeric(12, 4) not null default 100 check (liquidity_b > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'resolved')),
  closes_at timestamptz,
  actual_time_seconds integer,
  winning_outcome_id uuid,
  volume numeric(18, 6) not null default 0,
  created_at timestamptz not null default now(),
  unique (race_id, athlete_id)
);

-- Fascia di tempo: vince se min_seconds <= tempo < max_seconds (null = illimitato).
create table outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets (id) on delete cascade,
  label text not null,
  min_seconds integer,
  max_seconds integer,
  q_shares numeric(18, 6) not null default 0,
  sort_order integer not null default 0,
  check (min_seconds is null or max_seconds is null or min_seconds < max_seconds)
);

alter table markets
  add constraint markets_winning_outcome_fk
  foreign key (winning_outcome_id) references outcomes (id) on delete set null;

create table positions (
  user_id uuid not null references users (id) on delete cascade,
  outcome_id uuid not null references outcomes (id) on delete cascade,
  market_id uuid not null references markets (id) on delete cascade,
  shares numeric(18, 6) not null default 0 check (shares >= 0),
  cost_basis numeric(18, 6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, outcome_id)
);

create table trades (
  id bigint generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  market_id uuid not null references markets (id) on delete cascade,
  outcome_id uuid not null references outcomes (id) on delete cascade,
  side text not null check (side in ('buy', 'sell')),
  shares numeric(18, 6) not null,
  cost numeric(18, 6) not null,
  price_after double precision not null,
  created_at timestamptz not null default now()
);

create table price_snapshots (
  id bigint generated always as identity primary key,
  market_id uuid not null references markets (id) on delete cascade,
  outcome_id uuid not null references outcomes (id) on delete cascade,
  price double precision not null,
  created_at timestamptz not null default now()
);

create index outcomes_market_idx on outcomes (market_id, sort_order);
create index markets_race_idx on markets (race_id);
create index positions_market_idx on positions (market_id);
create index trades_market_idx on trades (market_id, created_at desc);
create index trades_user_idx on trades (user_id, created_at desc);
create index snapshots_market_idx on price_snapshots (market_id, created_at);

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

-- Prezzi LMSR correnti: p_i = exp(q_i/b) / sum_j exp(q_j/b) (log-sum-exp per stabilità).
create or replace function market_prices(p_market_id uuid)
returns table (outcome_id uuid, price double precision)
language sql
stable
as $$
  with m as (
    select liquidity_b::float8 as b from markets where id = p_market_id
  ),
  o as (
    select id, q_shares::float8 as q from outcomes where market_id = p_market_id
  ),
  mx as (
    select max(q) as qmax from o
  ),
  e as (
    select o.id, exp((o.q - mx.qmax) / m.b) as w from o, mx, m
  )
  select e.id, e.w / sum(e.w) over () from e;
$$;

create or replace function snapshot_market(p_market_id uuid)
returns void
language sql
as $$
  insert into price_snapshots (market_id, outcome_id, price)
  select p_market_id, mp.outcome_id, mp.price from market_prices(p_market_id) mp;
$$;

-- Prezzi correnti per tutte le fasce (per classifica e portfolio).
create or replace view outcome_prices as
with base as (
  select o.id as outcome_id, o.market_id, o.q_shares::float8 as q, m.liquidity_b::float8 as b,
         m.status, m.winning_outcome_id
  from outcomes o
  join markets m on m.id = o.market_id
),
w as (
  select *, exp((q - max(q) over (partition by market_id)) / b) as weight from base
)
select
  outcome_id,
  market_id,
  case
    when status = 'resolved' then case when outcome_id = winning_outcome_id then 1.0 else 0.0 end
    else weight / sum(weight) over (partition by market_id)
  end as price
from w;

-- Classifica: saldo + valore di mercato delle posizioni nei mercati non ancora risolti.
create or replace view leaderboard as
select
  u.id,
  u.username,
  u.avatar_url,
  u.balance,
  coalesce(sum(pos.shares * op.price) filter (where m.status <> 'resolved'), 0) as positions_value,
  u.balance + coalesce(sum(pos.shares * op.price) filter (where m.status <> 'resolved'), 0) as total_value
from users u
left join positions pos on pos.user_id = u.id and pos.shares > 0
left join outcome_prices op on op.outcome_id = pos.outcome_id
left join markets m on m.id = pos.market_id
group by u.id;

-- ---------------------------------------------------------------------------
-- Creazione mercato (con probabilità iniziali opzionali)
-- p_outcomes: [{ "label": "< 3:15:00", "min_seconds": null, "max_seconds": 11700, "prob": 0.2 }, ...]
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
    raise exception 'Servono almeno 2 fasce';
  end if;

  select coalesce(sum(nullif(x ->> 'prob', '')::float8), 0)
    into v_prob_sum
    from jsonb_array_elements(p_outcomes) x;

  insert into markets (race_id, athlete_id, liquidity_b, closes_at)
  values (
    p_race_id,
    p_athlete_id,
    v_b,
    coalesce(p_closes_at, (select starts_at from races where id = p_race_id))
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

-- ---------------------------------------------------------------------------
-- Trading
-- ---------------------------------------------------------------------------

-- Compra quote spendendo p_amount crediti.
-- Con LMSR: x = b * ln(1 + (exp(A/b) - 1) / p_i)
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
    raise exception 'Devi effettuare il login';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Importo non valido';
  end if;

  select market_id into v_market_id from outcomes where id = p_outcome_id;
  if v_market_id is null then
    raise exception 'Fascia non trovata';
  end if;

  select * into v_market from markets where id = v_market_id for update;
  if v_market.status <> 'open' or (v_market.closes_at is not null and v_market.closes_at <= now()) then
    raise exception 'Il mercato è chiuso';
  end if;

  v_b := v_market.liquidity_b::float8;
  if p_amount::float8 / v_b > 50 then
    raise exception 'Importo troppo alto per la liquidità di questo mercato';
  end if;

  select balance into v_balance from users where id = p_user_id for update;
  if v_balance is null then
    raise exception 'Utente non trovato';
  end if;
  if v_balance < p_amount then
    raise exception 'Saldo insufficiente';
  end if;

  select mp.price into v_price from market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;
  v_shares := round((v_b * ln(1 + (exp(p_amount::float8 / v_b) - 1) / v_price))::numeric, 6);
  if v_shares <= 0 then
    raise exception 'Importo troppo piccolo';
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

-- Vende p_shares quote. Ricavo LMSR: -b * ln(1 - p_i + p_i * exp(-x/b))
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
    raise exception 'Devi effettuare il login';
  end if;
  if p_shares is null or p_shares <= 0 then
    raise exception 'Numero di quote non valido';
  end if;

  select market_id into v_market_id from outcomes where id = p_outcome_id;
  if v_market_id is null then
    raise exception 'Fascia non trovata';
  end if;

  select * into v_market from markets where id = v_market_id for update;
  if v_market.status <> 'open' or (v_market.closes_at is not null and v_market.closes_at <= now()) then
    raise exception 'Il mercato è chiuso';
  end if;

  select * into v_position from positions
    where user_id = p_user_id and outcome_id = p_outcome_id for update;
  if not found or v_position.shares < p_shares then
    raise exception 'Non hai abbastanza quote';
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
-- Risoluzione: l'admin inserisce il tempo reale, la fascia vincente paga 1 credito/quota.
-- ---------------------------------------------------------------------------

create or replace function resolve_market(p_market_id uuid, p_actual_time_seconds integer)
returns uuid
language plpgsql
as $$
declare
  v_market markets%rowtype;
  v_winner uuid;
begin
  if p_actual_time_seconds is null or p_actual_time_seconds <= 0 then
    raise exception 'Tempo non valido';
  end if;

  select * into v_market from markets where id = p_market_id for update;
  if not found then
    raise exception 'Mercato non trovato';
  end if;
  if v_market.status = 'resolved' then
    raise exception 'Mercato già risolto';
  end if;

  select id into v_winner from outcomes
    where market_id = p_market_id
      and (min_seconds is null or p_actual_time_seconds >= min_seconds)
      and (max_seconds is null or p_actual_time_seconds < max_seconds)
    order by sort_order
    limit 1;
  if v_winner is null then
    raise exception 'Nessuna fascia contiene questo tempo';
  end if;

  update users u
    set balance = u.balance + pos.shares
    from positions pos
    where pos.user_id = u.id and pos.outcome_id = v_winner and pos.shares > 0;

  update markets
    set status = 'resolved',
        actual_time_seconds = p_actual_time_seconds,
        winning_outcome_id = v_winner
    where id = p_market_id;

  insert into price_snapshots (market_id, outcome_id, price)
  select p_market_id, id, case when id = v_winner then 1.0 else 0.0 end
  from outcomes where market_id = p_market_id;

  update races r
    set status = 'resolved'
    where r.id = v_market.race_id
      and not exists (
        select 1 from markets m where m.race_id = r.id and m.status <> 'resolved'
      );

  return v_winner;
end;
$$;
