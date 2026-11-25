-- Phase 1 viral incentives: referrals, market approval/hide/goal, beat-the-market.

alter table athlete_rewards drop constraint if exists athlete_rewards_kind_check;
alter table athlete_rewards
  add constraint athlete_rewards_kind_check
  check (kind in ('personal_best', 'steady', 'personal_improvement', 'first_finish'));

-- ---------------------------------------------------------------------------
-- Referrals
-- ---------------------------------------------------------------------------

create table if not exists referrals (
  invitee_id uuid primary key references users (id) on delete cascade,
  inviter_id uuid not null references users (id) on delete cascade,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);

create index if not exists referrals_inviter_idx on referrals (inviter_id);

-- ---------------------------------------------------------------------------
-- Market columns: approval, hide, declared goal
-- ---------------------------------------------------------------------------

alter table markets
  add column if not exists hidden_by_athlete boolean not null default false,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists approval_status text not null default 'auto',
  add column if not exists goal_seconds integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'markets_approval_status_check'
  ) then
    alter table markets
      add constraint markets_approval_status_check
      check (approval_status in ('auto', 'pending', 'approved', 'rejected'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Extend credit_ledger kinds
-- ---------------------------------------------------------------------------

alter table credit_ledger drop constraint if exists credit_ledger_kind_check;
alter table credit_ledger
  add constraint credit_ledger_kind_check check (kind in (
    'signup', 'trade', 'prediction_stake', 'prediction_payout',
    'athlete_bonus', 'weekly_km', 'premium_unlock',
    'referral_bonus', 'beat_market', 'goal_bonus', 'return_bonus',
    'club_bonus', 'sponsor_prize'
  ));

-- ---------------------------------------------------------------------------
-- Referral bonus: +200 each when invitee places first prediction/trade
-- ---------------------------------------------------------------------------

create or replace function award_referral_bonus(p_invitee_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_ref referrals%rowtype;
begin
  select * into v_ref from referrals where invitee_id = p_invitee_id for update;
  if not found or v_ref.credited_at is not null then
    return false;
  end if;

  update referrals set credited_at = now() where invitee_id = p_invitee_id;

  perform grant_credits(
    v_ref.inviter_id,
    200,
    'referral_bonus',
    jsonb_build_object('invitee_id', p_invitee_id, 'role', 'inviter')
  );
  perform grant_credits(
    p_invitee_id,
    200,
    'referral_bonus',
    jsonb_build_object('inviter_id', v_ref.inviter_id, 'role', 'invitee')
  );
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Self-trade guard helpers (used from app; SQL buy still open but checked in app)
-- Visible markets: not hidden, not rejected, and approved or auto
-- ---------------------------------------------------------------------------

create or replace function market_is_publicly_visible(p_market markets)
returns boolean
language sql
immutable
as $$
  select not p_market.hidden_by_athlete
    and p_market.approval_status in ('auto', 'approved');
$$;

-- ---------------------------------------------------------------------------
-- Athlete bonus: PB / steady / relative improvement + beat market + goal
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
  v_avg3 numeric;
  v_kind text;
  v_amount numeric;
  v_ref integer;
  v_refund numeric;
  v_median numeric;
  v_prev_count integer;
  v_beat_margin integer;
  v_beat_amount numeric;
begin
  select m.id, m.athlete_id, m.actual_time_seconds as t, m.pricing, m.goal_seconds,
         a.user_id, a.personal_best_seconds,
         r.distance_km, r.starts_at
    into v_m
    from markets m
    join athletes a on a.id = m.athlete_id
    join races r on r.id = m.race_id
   where m.id = p_market_id and m.kind in ('time', 'goal') and m.status = 'resolved';

  if not found or v_m.user_id is null or v_m.t is null then
    -- Still try goal-only custom markets resolved via winning Yes
    select m.id, m.athlete_id, m.actual_time_seconds as t, m.pricing, m.goal_seconds,
           a.user_id, a.personal_best_seconds,
           r.distance_km, r.starts_at
      into v_m
      from markets m
      join athletes a on a.id = m.athlete_id
      join races r on r.id = m.race_id
     where m.id = p_market_id and m.goal_seconds is not null and m.status = 'resolved';
    if not found or v_m.user_id is null then
      return;
    end if;
  end if;

  if v_m.t is not null then
    select min(m2.actual_time_seconds) into v_pb
      from markets m2 join races r2 on r2.id = m2.race_id
     where m2.athlete_id = v_m.athlete_id and m2.kind in ('time', 'goal') and m2.status = 'resolved'
       and m2.id <> v_m.id and r2.distance_km = v_m.distance_km and r2.starts_at < v_m.starts_at
       and m2.actual_time_seconds is not null;
    v_pb := least(v_pb, v_m.personal_best_seconds);

    select m2.actual_time_seconds into v_last
      from markets m2 join races r2 on r2.id = m2.race_id
     where m2.athlete_id = v_m.athlete_id and m2.kind in ('time', 'goal') and m2.status = 'resolved'
       and m2.id <> v_m.id and r2.distance_km = v_m.distance_km and r2.starts_at < v_m.starts_at
       and m2.actual_time_seconds is not null
     order by r2.starts_at desc
     limit 1;

    select avg(x.t), count(*)::int into v_avg3, v_prev_count
      from (
        select m2.actual_time_seconds as t
          from markets m2 join races r2 on r2.id = m2.race_id
         where m2.athlete_id = v_m.athlete_id and m2.kind in ('time', 'goal') and m2.status = 'resolved'
           and m2.id <> v_m.id and r2.distance_km = v_m.distance_km and r2.starts_at < v_m.starts_at
           and m2.actual_time_seconds is not null
         order by r2.starts_at desc
         limit 3
      ) x;

    if v_pb is not null and v_m.t < v_pb then
      v_kind := 'personal_best'; v_amount := 200; v_ref := v_pb;
    elsif v_prev_count = 0 then
      -- First time on this distance: finish bonus
      v_kind := 'first_finish'; v_amount := 75; v_ref := v_m.t;
    elsif v_avg3 is not null and v_m.t < v_avg3 then
      v_kind := 'personal_improvement'; v_amount := 100; v_ref := round(v_avg3)::int;
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

    -- Beat the market: actual time better (lower) than median prediction
    if v_m.pricing = 'exact_time' then
      select percentile_cont(0.5) within group (order by predicted_seconds)
        into v_median
        from time_predictions
       where market_id = p_market_id;
    end if;

    if v_median is not null and v_m.t < v_median then
      v_beat_margin := greatest(0, round(v_median)::int - v_m.t);
      -- Base 50 + 1 credit per second under median, capped at 300
      v_beat_amount := least(300, 50 + v_beat_margin);
      if not exists (
        select 1 from credit_ledger
         where user_id = v_m.user_id and kind = 'beat_market'
           and meta->>'market_id' = p_market_id::text
      ) then
        perform grant_credits(
          v_m.user_id,
          v_beat_amount,
          'beat_market',
          jsonb_build_object(
            'market_id', p_market_id,
            'actual', v_m.t,
            'median', v_median,
            'margin_seconds', v_beat_margin
          )
        );
      end if;
    end if;

    -- Declared goal bonus
    if v_m.goal_seconds is not null and v_m.t <= v_m.goal_seconds then
      if not exists (
        select 1 from credit_ledger
         where user_id = v_m.user_id and kind = 'goal_bonus'
           and meta->>'market_id' = p_market_id::text
      ) then
        perform grant_credits(
          v_m.user_id,
          100,
          'goal_bonus',
          jsonb_build_object(
            'market_id', p_market_id,
            'actual', v_m.t,
            'goal', v_m.goal_seconds
          )
        );
      end if;
    end if;

    select r.refunded_eur into v_refund from refund_bib_if_eligible(p_market_id) r;
  end if;

  if v_kind is null and v_refund is null and v_beat_amount is null then
    return;
  end if;

  reward_kind := coalesce(v_kind, 'beat_market');
  reward_amount := coalesce(v_amount, v_beat_amount);
  bib_refund_eur := v_refund;
  return next;
end;
$$;

-- Allow market kind 'goal' alongside time/custom (soft: stored as custom with goal_seconds
-- or as kind goal if check allows). Expand markets.kind check if present.
do $$
begin
  -- Drop old kind check if any and recreate broader
  if exists (
    select 1 from information_schema.check_constraints
     where constraint_name like '%markets%kind%' or constraint_name = 'markets_kind_check'
  ) then
    alter table markets drop constraint if exists markets_kind_check;
  end if;
exception when others then
  null;
end $$;

alter table markets drop constraint if exists markets_kind_check;
-- kind is text without strict check in early migrations; keep flexible.
