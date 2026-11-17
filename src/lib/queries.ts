import "server-only";
import { query, queryOne } from "@/lib/db";
import type { MarketWithRelations, Race } from "@/lib/types";

const MARKET_SELECT = `
  select m.*,
         to_jsonb(r) as race,
         to_jsonb(a) as athlete,
         (select coalesce(jsonb_agg(o order by o.sort_order), '[]'::jsonb)
            from outcomes o where o.market_id = m.id) as outcomes
    from markets m
    join races r on r.id = m.race_id
    join athletes a on a.id = m.athlete_id
`;

export async function getMarkets(opts: { raceId?: string } = {}) {
  return query<MarketWithRelations>(
    `${MARKET_SELECT} where ($1::uuid is null or m.race_id = $1::uuid) order by m.closes_at nulls last`,
    [opts.raceId ?? null],
  );
}

export async function getMarket(id: string) {
  return queryOne<MarketWithRelations>(`${MARKET_SELECT} where m.id = $1`, [id]);
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
