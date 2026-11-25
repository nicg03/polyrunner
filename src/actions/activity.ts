"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { weekStartUtc } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
import { getActivityProvider } from "@/lib/activity";
import type { ActionResult } from "@/lib/types";

const RETURN_BONUS = 50;
const RETURN_GAP_DAYS = 7;

export async function connectActivityProvider(providerId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  const provider = getActivityProvider(providerId);
  const res = await provider.connect(profile.id);
  if ("error" in res) return { error: res.error };
  revalidatePath("/connect-devices");
  return { ok: `${provider.label} collegato` };
}

export async function disconnectActivityProvider(providerId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  await getActivityProvider(providerId).disconnect(profile.id);
  revalidatePath("/connect-devices");
  return { ok: "Dispositivo scollegato" };
}

export async function syncActivityWeek(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const source = await queryOne<{ provider: string }>(
    `select provider from activity_sources
      where user_id = $1 and status = 'connected'
      order by (provider = 'mock') asc, last_sync_at desc nulls last
      limit 1`,
    [profile.id],
  );
  if (!source) return { error: "Collega prima un dispositivo" };

  const week = weekStartUtc();
  const prefs = await queryOne<{ last_activity_at: string | null }>(
    `select last_activity_at from user_activity_prefs where user_id = $1`,
    [profile.id],
  );

  const stats = await getActivityProvider(source.provider).syncWeek(profile.id, week);

  // Return bonus after 7+ days idle
  if (prefs?.last_activity_at) {
    const gap =
      (Date.now() - new Date(prefs.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
    if (gap >= RETURN_GAP_DAYS) {
      const already = await queryOne(
        `select 1 from return_bonus_awards
          where user_id = $1 and awarded_at > now() - interval '14 days'`,
        [profile.id],
      );
      if (!already) {
        await query(
          `insert into return_bonus_awards (user_id, gap_days, amount) values ($1, $2, $3)`,
          [profile.id, Math.floor(gap), RETURN_BONUS],
        );
        await query(`select grant_credits($1, $2, 'return_bonus', $3::jsonb)`, [
          profile.id,
          RETURN_BONUS,
          JSON.stringify({ gap_days: Math.floor(gap) }),
        ]);
      }
    }
  }

  revalidatePath("/connect-devices");
  revalidatePath("/commitment");
  return {
    ok: `Sync: ${stats.runsCount} uscite, ${stats.distanceKm} km questa settimana`,
  };
}

export async function setWeeklyMarketsOptIn(optIn: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  await query(
    `insert into user_activity_prefs (user_id, weekly_markets_opt_in, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update
       set weekly_markets_opt_in = $2, updated_at = now()`,
    [profile.id, optIn],
  );
  revalidatePath("/connect-devices");
  return { ok: optIn ? "Mercati settimanali attivati" : "Mercati settimanali disattivati" };
}
