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

export async function getMarkets(opts: { raceId?: string } = {}) {
  return query<MarketWithRelations>(
    `${MARKET_SELECT} where ($1::uuid is null or m.race_id = $1::uuid) order by m.closes_at nulls last, m.kind desc, m.created_at`,
    [opts.raceId ?? null],
  );
}

export async function getMarket(id: string) {
  return queryOne<MarketWithRelations>(`${MARKET_SELECT} where m.id = $1`, [id]);
}

/** The runners a user follows, plus their own runner profile. Empty when logged out. */
export async function getFriends(userId: string | null) {
  if (!userId) return [];
  return query<Athlete>(
    `select a.* from athletes a
      where a.category = 'friend'
        and (a.user_id = $1
             or exists (select 1 from follows f where f.user_id = $1 and f.athlete_id = a.id))
      order by a.user_id = $1 desc, a.name`,
    [userId],
  );
}

export interface RunnerResult extends Athlete {
  username: string | null;
  following: boolean;
  followers: number;
}

/** Friend runners matching a name or username. Empty search returns no rows: type to find people. */
export async function searchRunners(search: string, userId: string) {
  const q = search.trim();
  if (!q) return [];
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  return query<RunnerResult>(
    `select a.*, u.username,
            exists (select 1 from follows f where f.user_id = $2 and f.athlete_id = a.id) as following,
            (select count(*)::int from follows f where f.athlete_id = a.id) as followers
       from athletes a
       left join users u on u.id = a.user_id
      where a.category = 'friend' and a.user_id is distinct from $2
        and (a.name ilike $1 or u.username ilike $1)
      order by
        case when lower(u.username) = lower($3) or lower(a.name) = lower($3) then 0 else 1 end,
        followers desc, a.name
      limit 30`,
    [pattern, userId, q],
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
