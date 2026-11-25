import "server-only";
import { query, queryOne } from "@/lib/db";
import type { Athlete, MarketWithRelations, Race } from "@/lib/types";

const MARKET_SELECT = `
  select m.*,
         to_jsonb(r) as race,
         to_jsonb(a) as athlete,
         (select coalesce(jsonb_agg(o order by o.sort_order), '[]'::jsonb)
            from outcomes o where o.market_id = m.id) as outcomes
    from markets m
    join races r on r.id = m.race_id
    left join athletes a on a.id = m.athlete_id
`;

const VISIBLE = `(coalesce(m.hidden_by_athlete, false) = false and coalesce(m.approval_status, 'auto') in ('auto', 'approved'))`;

export async function getMarkets(opts: { raceId?: string; includeHidden?: boolean } = {}) {
  const vis = opts.includeHidden ? "true" : VISIBLE;
  return query<MarketWithRelations>(
    `${MARKET_SELECT} where ($1::uuid is null or m.race_id = $1::uuid) and ${vis}
     order by m.closes_at nulls last, m.kind desc, m.created_at`,
    [opts.raceId ?? null],
  );
}

export async function getMarket(id: string, opts: { includeHidden?: boolean } = {}) {
  const vis = opts.includeHidden ? "true" : VISIBLE;
  return queryOne<MarketWithRelations>(`${MARKET_SELECT} where m.id = $1 and ${vis}`, [id]);
}

/** Accepted friends' runner profiles, plus your own. Empty when logged out. */
export async function getFriends(userId: string | null) {
  if (!userId) return [];
  return query<Athlete>(
    `select a.* from athletes a
      where a.category = 'friend'
        and (a.user_id = $1
             or exists (
               select 1 from friendships f
                where f.status = 'accepted'
                  and ((f.user_low = $1 and f.user_high = a.user_id)
                    or (f.user_high = $1 and f.user_low = a.user_id))
             ))
      order by a.user_id = $1 desc, a.name`,
    [userId],
  );
}

export type FriendshipStatus = "none" | "friends" | "pending_out" | "pending_in";

export interface RunnerResult extends Athlete {
  username: string | null;
  friendship: FriendshipStatus;
  friends_count: number;
}

/** Friend runners matching a name or username. Empty search returns no rows. */
export async function searchRunners(search: string, userId: string) {
  const q = search.trim();
  if (!q) return [];
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  return query<RunnerResult>(
    `select a.*, u.username,
            case
              when f.status = 'accepted' then 'friends'
              when f.status = 'pending' and f.requested_by = $2 then 'pending_out'
              when f.status = 'pending' then 'pending_in'
              else 'none'
            end as friendship,
            (select count(*)::int from friendships ff
              where ff.status = 'accepted'
                and (ff.user_low = a.user_id or ff.user_high = a.user_id)) as friends_count
       from athletes a
       join users u on u.id = a.user_id
       left join friendships f on f.status in ('pending', 'accepted')
         and ((f.user_low = least($2::uuid, a.user_id) and f.user_high = greatest($2::uuid, a.user_id)))
      where a.category = 'friend' and a.user_id <> $2
        and (a.name ilike $1 or u.username ilike $1)
      order by
        case when lower(u.username) = lower($3) or lower(a.name) = lower($3) then 0 else 1 end,
        friends_count desc, a.name
      limit 30`,
    [pattern, userId, q],
  );
}

export interface IncomingRequest {
  user_id: string;
  username: string;
  avatar_url: string | null;
  athlete_id: string | null;
  athlete_name: string | null;
}

export async function getIncomingFriendRequests(userId: string) {
  return query<IncomingRequest>(
    `select u.id as user_id, u.username, u.avatar_url,
            a.id as athlete_id, a.name as athlete_name
       from friendships f
       join users u on u.id = f.requested_by
       left join athletes a on a.user_id = u.id and a.category = 'friend'
      where f.status = 'pending'
        and f.requested_by <> $1
        and (f.user_low = $1 or f.user_high = $1)
      order by f.created_at desc`,
    [userId],
  );
}

/** Verified PB for this athlete closest to the race distance (within 2%). */
export async function getAthletePb(athleteId: string, distanceKm: number) {
  return queryOne<{ distance_km: number; time_seconds: number }>(
    `select distance_km, time_seconds from athlete_pbs
      where athlete_id = $1 and abs(distance_km - $2) / $2 <= 0.02
      order by abs(distance_km - $2)
      limit 1`,
    [athleteId, distanceKm],
  );
}

export async function getAthletePbs(athleteId: string) {
  return query<{ distance_km: number; time_seconds: number; updated_at: string }>(
    "select distance_km, time_seconds, updated_at from athlete_pbs where athlete_id = $1 order by distance_km",
    [athleteId],
  );
}

export async function getRaces() {
  return query<Race>("select * from races order by starts_at");
}

export async function getRace(id: string) {
  return queryOne<Race>("select * from races where id = $1", [id]);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
