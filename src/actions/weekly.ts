"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { weekStartUtc } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
import { getWeekStats } from "@/lib/activity";
import type { ActionResult } from "@/lib/types";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Solo gli admin possono farlo");
}

/** Admin/cron: create weekly Yes/No markets for opted-in runners. */
export async function generateWeeklyMarkets(): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  const week = weekStartUtc();
  const users = await query<{
    user_id: string;
    athlete_id: string;
    name: string;
    target_runs_per_week: number;
    target_km_per_week: number;
  }>(
    `select p.user_id, a.id as athlete_id, a.name,
            p.target_runs_per_week, p.target_km_per_week
       from user_activity_prefs p
       join athletes a on a.user_id = p.user_id and a.category = 'friend'
      where p.weekly_markets_opt_in = true`,
  );

  let created = 0;
  for (const u of users) {
    // Ensure a synthetic "week race" exists
    let race = await queryOne<{ id: string }>(
      `select id from races where name = $1 and starts_at::date = ($2::date + 7)`,
      [`Settimana ${week}`, week],
    );
    if (!race) {
      const [r] = await query<{ id: string }>(
        `insert into races (name, starts_at, distance_km, location, status)
         values ($1, ($2::date + 7)::timestamptz, 0, 'Settimanale', 'upcoming')
         returning id`,
        [`Settimana ${week}`, week],
      );
      race = r;
    }

    const existing = await queryOne(
      `select 1 from markets where athlete_id = $1 and week_start = $2::date and kind = 'weekly_freq'`,
      [u.athlete_id, week],
    );
    if (existing) continue;

    const qRuns = `${u.name} correrà ${u.target_runs_per_week} volte questa settimana?`;
    const [freq] = await query<{ id: string }>(
      `select create_custom_market($1, $2, $3, 80, ($4::date + 7)::timestamptz, 0.55) as id`,
      [race.id, u.athlete_id, qRuns, week],
    );
    await query(
      `update markets set kind = 'weekly_freq', week_start = $2::date, approval_status = 'auto',
          meta = jsonb_build_object('target_runs', $3)
        where id = $1`,
      [freq.id, week, u.target_runs_per_week],
    );

    const qKm = `${u.name} supererà ${u.target_km_per_week} km questa settimana?`;
    const [km] = await query<{ id: string }>(
      `select create_custom_market($1, $2, $3, 80, ($4::date + 7)::timestamptz, 0.55) as id`,
      [race.id, u.athlete_id, qKm, week],
    );
    await query(
      `update markets set kind = 'weekly_km', week_start = $2::date, approval_status = 'auto',
          meta = jsonb_build_object('target_km', $3)
        where id = $1`,
      [km.id, week, u.target_km_per_week],
    );
    created += 2;
  }

  revalidatePath("/", "layout");
  return { ok: `Creati ${created} mercati settimanali` };
}

/** Admin/cron: resolve last week's markets from activity stats. */
export async function resolveWeeklyMarkets(): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  const week = weekStartUtc();
  // Resolve previous week
  const prev = new Date(week + "T00:00:00Z");
  prev.setUTCDate(prev.getUTCDate() - 7);
  const prevWeek = prev.toISOString().slice(0, 10);

  const markets = await query<{
    id: string;
    kind: string;
    athlete_user_id: string;
    meta: { target_runs?: number; target_km?: number };
  }>(
    `select m.id, m.kind, a.user_id as athlete_user_id, m.meta
       from markets m
       join athletes a on a.id = m.athlete_id
      where m.week_start = $1::date
        and m.kind in ('weekly_freq', 'weekly_km')
        and m.status = 'open'`,
    [prevWeek],
  );

  let resolved = 0;
  for (const m of markets) {
    const stats = await getWeekStats(m.athlete_user_id, prevWeek);
    const yes =
      m.kind === "weekly_freq"
        ? (stats?.runs_count ?? 0) >= (m.meta?.target_runs ?? 3)
        : Number(stats?.distance_km ?? 0) >= Number(m.meta?.target_km ?? 30);

    const outcome = await queryOne<{ id: string }>(
      `select id from outcomes where market_id = $1 and lower(label) = $2`,
      [m.id, yes ? "yes" : "no"],
    );
    if (!outcome) continue;
    await query(`select resolve_market_outcome($1, $2)`, [m.id, outcome.id]);
    resolved++;
  }

  revalidatePath("/", "layout");
  return { ok: `Risolti ${resolved} mercati settimanali` };
}
