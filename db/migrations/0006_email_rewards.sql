-- PolyRunner: login con email e bonus per gli atleti che migliorano.

alter table users add column email text;
create unique index users_email_lower_idx on users (lower(email)) where email is not null;

create table athlete_rewards (
  market_id uuid primary key references markets (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('personal_best', 'steady')),
  amount numeric(18, 6) not null,
  time_seconds integer not null,
  reference_seconds integer not null,
  created_at timestamptz not null default now()
);

-- Dopo la risoluzione di un mercato a tempo, premia l'utente collegato all'atleta:
--  - personal best (battuto il miglior tempo noto sulla stessa distanza): 200 crediti
--  - altrimenti, al massimo 60s in più dell'ultima corsa sulla stessa distanza: 50 crediti
-- Idempotente: un solo premio per mercato. Restituisce una riga se è stato assegnato.
create or replace function award_athlete_bonus(p_market_id uuid)
returns table (reward_kind text, reward_amount numeric)
language plpgsql
as $$
declare
  v_m record;
  v_pb integer;
  v_last integer;
  v_kind text;
  v_amount numeric;
  v_ref integer;
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

  -- Miglior tempo precedente sulla stessa distanza (storico + PB inserito a mano).
  select min(m2.actual_time_seconds) into v_pb
    from markets m2 join races r2 on r2.id = m2.race_id
   where m2.athlete_id = v_m.athlete_id and m2.kind = 'time' and m2.status = 'resolved'
     and m2.id <> v_m.id and r2.distance_km = v_m.distance_km and r2.starts_at < v_m.starts_at;
  v_pb := least(v_pb, v_m.personal_best_seconds); -- least ignora i NULL

  -- Ultima corsa sulla stessa distanza.
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
  else
    return;
  end if;

  insert into athlete_rewards (market_id, user_id, kind, amount, time_seconds, reference_seconds)
  values (p_market_id, v_m.user_id, v_kind, v_amount, v_m.t, v_ref)
  on conflict (market_id) do nothing;

  if not found then
    return;
  end if;

  update users set balance = balance + v_amount where id = v_m.user_id;
  reward_kind := v_kind;
  reward_amount := v_amount;
  return next;
end;
$$;
