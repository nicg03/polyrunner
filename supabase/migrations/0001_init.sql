-- PolyRunner: schema iniziale
-- Mercati di previsione sui tempi di gara con market maker LMSR e crediti virtuali.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 32),
  avatar_url text,
  balance numeric(18, 6) not null default 1000 check (balance >= 0),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  distance_km numeric(6, 3) not null check (distance_km > 0),
  location text,
  image_url text,
  status text not null default 'upcoming' check (status in ('upcoming', 'closed', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  personal_best_seconds integer check (personal_best_seconds > 0),
  bio text,
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  athlete_id uuid not null references public.athletes (id) on delete cascade,
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
create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  label text not null,
  min_seconds integer,
  max_seconds integer,
  q_shares numeric(18, 6) not null default 0,
  sort_order integer not null default 0,
  check (min_seconds is null or max_seconds is null or min_seconds < max_seconds)
);

alter table public.markets
  add constraint markets_winning_outcome_fk
  foreign key (winning_outcome_id) references public.outcomes (id) on delete set null;

create table public.positions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  outcome_id uuid not null references public.outcomes (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  shares numeric(18, 6) not null default 0 check (shares >= 0),
  cost_basis numeric(18, 6) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, outcome_id)
);

create table public.trades (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  outcome_id uuid not null references public.outcomes (id) on delete cascade,
  side text not null check (side in ('buy', 'sell')),
  shares numeric(18, 6) not null,
  cost numeric(18, 6) not null,
  price_after double precision not null,
  created_at timestamptz not null default now()
);

create table public.price_snapshots (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets (id) on delete cascade,
  outcome_id uuid not null references public.outcomes (id) on delete cascade,
  price double precision not null,
  created_at timestamptz not null default now()
);

create index outcomes_market_idx on public.outcomes (market_id, sort_order);
create index markets_race_idx on public.markets (race_id);
create index positions_market_idx on public.positions (market_id);
create index trades_market_idx on public.trades (market_id, created_at desc);
create index trades_user_idx on public.trades (user_id, created_at desc);
create index snapshots_market_idx on public.price_snapshots (market_id, created_at);

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Prezzi LMSR correnti: p_i = exp(q_i/b) / sum_j exp(q_j/b) (log-sum-exp per stabilità).
create or replace function public.market_prices(p_market_id uuid)
returns table (outcome_id uuid, price double precision)
language sql
stable
set search_path = public
as $$
  with m as (
    select liquidity_b::float8 as b from public.markets where id = p_market_id
  ),
  o as (
    select id, q_shares::float8 as q from public.outcomes where market_id = p_market_id
  ),
  mx as (
    select max(q) as qmax from o
  ),
  e as (
    select o.id, exp((o.q - mx.qmax) / m.b) as w from o, mx, m
  )
  select e.id, e.w / sum(e.w) over () from e;
$$;

create or replace function public.snapshot_market(p_market_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.price_snapshots (market_id, outcome_id, price)
  select p_market_id, mp.outcome_id, mp.price from public.market_prices(p_market_id) mp;
$$;

-- Prezzi correnti per tutte le fasce (per leaderboard e portfolio).
create or replace view public.outcome_prices
with (security_invoker = true)
as
with base as (
  select o.id as outcome_id, o.market_id, o.q_shares::float8 as q, m.liquidity_b::float8 as b,
         m.status, m.winning_outcome_id
  from public.outcomes o
  join public.markets m on m.id = o.market_id
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
create or replace view public.leaderboard
with (security_invoker = true)
as
select
  p.id,
  p.username,
  p.avatar_url,
  p.balance,
  coalesce(sum(pos.shares * op.price) filter (where m.status <> 'resolved'), 0) as positions_value,
  p.balance + coalesce(sum(pos.shares * op.price) filter (where m.status <> 'resolved'), 0) as total_value
from public.profiles p
left join public.positions pos on pos.user_id = p.id and pos.shares > 0
left join public.outcome_prices op on op.outcome_id = pos.outcome_id
left join public.markets m on m.id = pos.market_id
group by p.id;

-- ---------------------------------------------------------------------------
-- Profilo automatico alla registrazione
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_username text;
begin
  v_base := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1),
    'runner'
  );
  v_base := left(regexp_replace(v_base, '[^a-zA-Z0-9_.-]', '', 'g'), 24);
  if char_length(v_base) < 2 then
    v_base := 'runner';
  end if;
  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := v_base || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username) values (new.id, v_username);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Creazione mercato (con probabilità iniziali opzionali)
-- p_outcomes: [{ "label": "< 3:15:00", "min_seconds": null, "max_seconds": 11700, "prob": 0.2 }, ...]
-- ---------------------------------------------------------------------------

create or replace function public.create_market_internal(
  p_race_id uuid,
  p_athlete_id uuid,
  p_liquidity_b numeric,
  p_closes_at timestamptz,
  p_outcomes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_id uuid;
  v_count integer;
  v_prob_sum double precision;
  v_item jsonb;
  v_idx integer := 0;
  v_prob double precision;
begin
  v_count := jsonb_array_length(p_outcomes);
  if v_count < 2 then
    raise exception 'Servono almeno 2 fasce';
  end if;

  select coalesce(sum(nullif(x ->> 'prob', '')::float8), 0)
    into v_prob_sum
    from jsonb_array_elements(p_outcomes) x;

  insert into public.markets (race_id, athlete_id, liquidity_b, closes_at)
  values (
    p_race_id,
    p_athlete_id,
    coalesce(p_liquidity_b, 100),
    coalesce(p_closes_at, (select starts_at from public.races where id = p_race_id))
  )
  returning id into v_market_id;

  for v_item in select * from jsonb_array_elements(p_outcomes) loop
    v_prob := nullif(v_item ->> 'prob', '')::float8;
    if v_prob_sum > 0 and v_prob is not null and v_prob > 0 then
      v_prob := v_prob / v_prob_sum;
    else
      v_prob := 1.0 / v_count;
    end if;

    insert into public.outcomes (market_id, label, min_seconds, max_seconds, q_shares, sort_order)
    values (
      v_market_id,
      v_item ->> 'label',
      nullif(v_item ->> 'min_seconds', '')::integer,
      nullif(v_item ->> 'max_seconds', '')::integer,
      round((coalesce(p_liquidity_b, 100)::float8 * ln(v_prob))::numeric, 6),
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  perform public.snapshot_market(v_market_id);
  return v_market_id;
end;
$$;

create or replace function public.create_market(
  p_race_id uuid,
  p_athlete_id uuid,
  p_liquidity_b numeric,
  p_closes_at timestamptz,
  p_outcomes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo gli admin possono creare mercati';
  end if;
  return public.create_market_internal(p_race_id, p_athlete_id, p_liquidity_b, p_closes_at, p_outcomes);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trading
-- ---------------------------------------------------------------------------

-- Compra quote spendendo p_amount crediti.
-- Con LMSR: x = b * ln(1 + (exp(A/b) - 1) / p_i)
create or replace function public.buy_shares(p_outcome_id uuid, p_amount numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_market_id uuid;
  v_market public.markets%rowtype;
  v_balance numeric;
  v_b double precision;
  v_price double precision;
  v_shares numeric;
  v_price_after double precision;
begin
  if v_user is null then
    raise exception 'Devi effettuare il login';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Importo non valido';
  end if;

  select market_id into v_market_id from public.outcomes where id = p_outcome_id;
  if v_market_id is null then
    raise exception 'Fascia non trovata';
  end if;

  select * into v_market from public.markets where id = v_market_id for update;
  if v_market.status <> 'open' or (v_market.closes_at is not null and v_market.closes_at <= now()) then
    raise exception 'Il mercato è chiuso';
  end if;

  v_b := v_market.liquidity_b::float8;
  if p_amount::float8 / v_b > 50 then
    raise exception 'Importo troppo alto per la liquidità di questo mercato';
  end if;

  select balance into v_balance from public.profiles where id = v_user for update;
  if v_balance is null then
    raise exception 'Profilo non trovato';
  end if;
  if v_balance < p_amount then
    raise exception 'Saldo insufficiente';
  end if;

  select mp.price into v_price from public.market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;
  v_shares := round((v_b * ln(1 + (exp(p_amount::float8 / v_b) - 1) / v_price))::numeric, 6);
  if v_shares <= 0 then
    raise exception 'Importo troppo piccolo';
  end if;

  update public.outcomes set q_shares = q_shares + v_shares where id = p_outcome_id;
  update public.profiles set balance = balance - p_amount where id = v_user;
  update public.markets set volume = volume + p_amount where id = v_market_id;

  insert into public.positions (user_id, outcome_id, market_id, shares, cost_basis)
  values (v_user, p_outcome_id, v_market_id, v_shares, p_amount)
  on conflict (user_id, outcome_id) do update
    set shares = public.positions.shares + excluded.shares,
        cost_basis = public.positions.cost_basis + excluded.cost_basis,
        updated_at = now();

  select mp.price into v_price_after from public.market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;

  insert into public.trades (user_id, market_id, outcome_id, side, shares, cost, price_after)
  values (v_user, v_market_id, p_outcome_id, 'buy', v_shares, p_amount, v_price_after);

  perform public.snapshot_market(v_market_id);

  return json_build_object(
    'shares', v_shares,
    'cost', p_amount,
    'avg_price', p_amount / v_shares,
    'price_after', v_price_after
  );
end;
$$;

-- Vende p_shares quote. Ricavo LMSR: -b * ln(1 - p_i + p_i * exp(-x/b))
create or replace function public.sell_shares(p_outcome_id uuid, p_shares numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_market_id uuid;
  v_market public.markets%rowtype;
  v_position public.positions%rowtype;
  v_b double precision;
  v_price double precision;
  v_proceeds numeric;
  v_price_after double precision;
begin
  if v_user is null then
    raise exception 'Devi effettuare il login';
  end if;
  if p_shares is null or p_shares <= 0 then
    raise exception 'Numero di quote non valido';
  end if;

  select market_id into v_market_id from public.outcomes where id = p_outcome_id;
  if v_market_id is null then
    raise exception 'Fascia non trovata';
  end if;

  select * into v_market from public.markets where id = v_market_id for update;
  if v_market.status <> 'open' or (v_market.closes_at is not null and v_market.closes_at <= now()) then
    raise exception 'Il mercato è chiuso';
  end if;

  select * into v_position from public.positions
    where user_id = v_user and outcome_id = p_outcome_id for update;
  if not found or v_position.shares < p_shares then
    raise exception 'Non hai abbastanza quote';
  end if;

  v_b := v_market.liquidity_b::float8;
  select mp.price into v_price from public.market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;
  v_proceeds := round((-v_b * ln(1 - v_price + v_price * exp(-p_shares::float8 / v_b)))::numeric, 6);
  if v_proceeds < 0 then
    v_proceeds := 0;
  end if;

  update public.outcomes set q_shares = q_shares - p_shares where id = p_outcome_id;
  update public.profiles set balance = balance + v_proceeds where id = v_user;
  update public.markets set volume = volume + v_proceeds where id = v_market_id;

  update public.positions
    set cost_basis = case when shares = p_shares then 0 else cost_basis * (shares - p_shares) / shares end,
        shares = shares - p_shares,
        updated_at = now()
    where user_id = v_user and outcome_id = p_outcome_id;

  select mp.price into v_price_after from public.market_prices(v_market_id) mp where mp.outcome_id = p_outcome_id;

  insert into public.trades (user_id, market_id, outcome_id, side, shares, cost, price_after)
  values (v_user, v_market_id, p_outcome_id, 'sell', p_shares, v_proceeds, v_price_after);

  perform public.snapshot_market(v_market_id);

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

create or replace function public.resolve_market(p_market_id uuid, p_actual_time_seconds integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_winner uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo gli admin possono risolvere i mercati';
  end if;
  if p_actual_time_seconds is null or p_actual_time_seconds <= 0 then
    raise exception 'Tempo non valido';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'Mercato non trovato';
  end if;
  if v_market.status = 'resolved' then
    raise exception 'Mercato già risolto';
  end if;

  select id into v_winner from public.outcomes
    where market_id = p_market_id
      and (min_seconds is null or p_actual_time_seconds >= min_seconds)
      and (max_seconds is null or p_actual_time_seconds < max_seconds)
    order by sort_order
    limit 1;
  if v_winner is null then
    raise exception 'Nessuna fascia contiene questo tempo';
  end if;

  update public.profiles p
    set balance = p.balance + pos.shares
    from public.positions pos
    where pos.user_id = p.id and pos.outcome_id = v_winner and pos.shares > 0;

  update public.markets
    set status = 'resolved',
        actual_time_seconds = p_actual_time_seconds,
        winning_outcome_id = v_winner
    where id = p_market_id;

  insert into public.price_snapshots (market_id, outcome_id, price)
  select p_market_id, id, case when id = v_winner then 1.0 else 0.0 end
  from public.outcomes where market_id = p_market_id;

  update public.races r
    set status = 'resolved'
    where r.id = v_market.race_id
      and not exists (
        select 1 from public.markets m where m.race_id = r.id and m.status <> 'resolved'
      );

  return v_winner;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permessi
-- ---------------------------------------------------------------------------

revoke execute on function public.create_market_internal(uuid, uuid, numeric, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.snapshot_market(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.buy_shares(uuid, numeric) from public, anon;
revoke execute on function public.sell_shares(uuid, numeric) from public, anon;
revoke execute on function public.resolve_market(uuid, integer) from public, anon;
revoke execute on function public.create_market(uuid, uuid, numeric, timestamptz, jsonb) from public, anon;

alter table public.profiles enable row level security;
alter table public.races enable row level security;
alter table public.athletes enable row level security;
alter table public.markets enable row level security;
alter table public.outcomes enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;
alter table public.price_snapshots enable row level security;

-- Lettura pubblica: è un gioco tra amici, tutto è visibile.
create policy "profiles read" on public.profiles for select using (true);
create policy "races read" on public.races for select using (true);
create policy "athletes read" on public.athletes for select using (true);
create policy "markets read" on public.markets for select using (true);
create policy "outcomes read" on public.outcomes for select using (true);
create policy "positions read" on public.positions for select using (true);
create policy "trades read" on public.trades for select using (true);
create policy "snapshots read" on public.price_snapshots for select using (true);

-- Il profilo è modificabile solo dal proprietario e solo su username/avatar.
create policy "profiles update own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from authenticated, anon;
grant update (username, avatar_url) on public.profiles to authenticated;

-- Gestione gare, atleti e mercati riservata agli admin.
create policy "races admin write" on public.races for all
  using (public.is_admin()) with check (public.is_admin());
create policy "athletes admin write" on public.athletes for all
  using (public.is_admin()) with check (public.is_admin());
create policy "markets admin update" on public.markets for update
  using (public.is_admin()) with check (public.is_admin());
create policy "markets admin delete" on public.markets for delete
  using (public.is_admin());

-- outcomes, positions, trades e price_snapshots si scrivono solo tramite le funzioni RPC.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.markets, public.outcomes, public.trades;
