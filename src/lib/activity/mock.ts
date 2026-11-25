import { query, queryOne } from "@/lib/db";
import type { ActivityProvider, ActivitySummary } from "./types";

/** Deterministic mock km/runs from user id + week for demos. */
function mockStats(userId: string, weekStart: string): ActivitySummary {
  let h = 0;
  const seed = `${userId}:${weekStart}`;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const runsCount = 2 + (h % 4); // 2–5
  const distanceKm = Math.round((15 + (h % 250) / 10) * 10) / 10;
  return {
    runsCount,
    distanceKm,
    lastActivityAt: new Date().toISOString(),
  };
}

export const mockActivityProvider: ActivityProvider = {
  id: "mock",
  label: "Demo (simulato)",
  async connect(userId) {
    await query(
      `insert into activity_sources (user_id, provider, status, last_sync_at)
       values ($1, 'mock', 'connected', now())
       on conflict (user_id, provider) do update
         set status = 'connected', last_sync_at = now()`,
      [userId],
    );
    return { ok: true };
  },
  async disconnect(userId) {
    await query(
      `update activity_sources set status = 'disconnected' where user_id = $1 and provider = 'mock'`,
      [userId],
    );
  },
  async syncWeek(userId, weekStart) {
    const stats = mockStats(userId, weekStart);
    await query(
      `insert into weekly_activity_stats (user_id, week_start, runs_count, distance_km, source, updated_at)
       values ($1, $2, $3, $4, 'mock', now())
       on conflict (user_id, week_start) do update
         set runs_count = excluded.runs_count,
             distance_km = excluded.distance_km,
             source = 'mock',
             updated_at = now()`,
      [userId, weekStart, stats.runsCount, stats.distanceKm],
    );
    await query(
      `insert into user_activity_prefs (user_id, last_activity_at, updated_at)
       values ($1, now(), now())
       on conflict (user_id) do update
         set last_activity_at = now(), updated_at = now()`,
      [userId],
    );
    await query(
      `update activity_sources set last_sync_at = now() where user_id = $1 and provider = 'mock'`,
      [userId],
    );
    return stats;
  },
};

export async function getConnectedProviders(userId: string) {
  return query<{ provider: string; status: string; last_sync_at: string | null }>(
    `select provider, status, last_sync_at from activity_sources where user_id = $1`,
    [userId],
  );
}

export async function getWeekStats(userId: string, weekStart: string) {
  return queryOne<{ runs_count: number; distance_km: number }>(
    `select runs_count, distance_km from weekly_activity_stats where user_id = $1 and week_start = $2`,
    [userId, weekStart],
  );
}
