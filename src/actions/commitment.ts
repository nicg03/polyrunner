"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { weekStartUtc } from "@/lib/credits";
import { query, queryOne } from "@/lib/db";
import { cappedTargetKm, suggestedWeeklyTarget } from "@/lib/activity";
import { CHARITIES } from "@/lib/charities";
import { getPaymentProvider } from "@/lib/payments/mock";
import { getWeekStats } from "@/lib/activity";
import type { ActionResult } from "@/lib/types";

export async function createCommitmentPot(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const amount = Number(String(formData.get("amount_eur") ?? "").replace(",", "."));
  const targetKm = Number(String(formData.get("target_km") ?? "").replace(",", "."));
  const charity = String(formData.get("charity") ?? "").trim();
  if (!(amount >= 5 && amount <= 50)) return { error: "Importo tra 5 e 50 €" };
  if (!(targetKm > 0)) return { error: "Obiettivo km non valido" };
  if (!(CHARITIES as readonly string[]).includes(charity)) {
    return { error: "Scegli una ONLUS dalla lista" };
  }

  // Cap +10% vs last pot
  const last = await queryOne<{ target_km: number }>(
    `select target_km from commitment_pots
      where user_id = $1 order by week_start desc limit 1`,
    [profile.id],
  );
  const capped = last ? cappedTargetKm(Number(last.target_km), targetKm) : targetKm;
  if (capped < targetKm - 0.01) {
    return { error: `Aumento massimo 10%: obiettivo max ${capped.toFixed(1)} km` };
  }

  const week = weekStartUtc();
  const existing = await queryOne(
    `select 1 from commitment_pots where user_id = $1 and week_start = $2::date`,
    [profile.id, week],
  );
  if (existing) return { error: "Hai già un Commitment Pot per questa settimana" };

  // Require a direct activity source (not manual upload)
  const src = await queryOne(
    `select 1 from activity_sources where user_id = $1 and status = 'connected'`,
    [profile.id],
  );
  if (!src) return { error: "Collega un dispositivo (Demo o Garmin) prima di attivare il Pot" };

  const pay = getPaymentProvider();
  const pre = await pay.preauthorize(profile.id, amount, { week, charity });

  await query(
    `insert into commitment_pots
       (user_id, week_start, target_km, amount_eur, charity_name, status, payment_ref)
     values ($1, $2::date, $3, $4, $5, 'active', $6)`,
    [profile.id, week, capped, amount, charity, pre.paymentRef],
  );

  revalidatePath("/commitment");
  return { ok: `Pot attivo: ${capped} km o doni ${amount} € a ${charity}` };
}

export async function claimCommitmentJolly(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const row = await queryOne<{ used_count: number }>(
    `select used_count from commitment_jolly where user_id = $1 and month_start = $2::date`,
    [profile.id, monthStart],
  );
  if (row && row.used_count >= 2) return { error: "Hai già usato 2 giorni jolly questo mese" };

  const week = weekStartUtc();
  const pot = await queryOne<{ id: string; jolly_used: boolean; payment_ref: string | null }>(
    `select id, jolly_used, payment_ref from commitment_pots
      where user_id = $1 and week_start = $2::date and status = 'active'`,
    [profile.id, week],
  );
  if (!pot) return { error: "Nessun pot attivo" };
  if (pot.jolly_used) return { error: "Jolly già usato su questo pot" };

  await query(
    `insert into commitment_jolly (user_id, month_start, used_count) values ($1, $2::date, 1)
     on conflict (user_id, month_start) do update set used_count = commitment_jolly.used_count + 1`,
    [profile.id, monthStart],
  );
  await query(`update commitment_pots set jolly_used = true where id = $1`, [pot.id]);
  // Treating jolly as auto-success for the week (illness / injury without justification)
  if (pot.payment_ref) await getPaymentProvider().voidPreauth(pot.payment_ref);
  await query(
    `update commitment_pots set status = 'succeeded', resolved_at = now() where id = $1`,
    [pot.id],
  );

  revalidatePath("/commitment");
  return { ok: "Giorno jolly usato: pot annullato senza addebito" };
}

export async function suspendCommitment(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  const week = weekStartUtc();
  const pot = await queryOne<{ id: string; payment_ref: string | null }>(
    `select id, payment_ref from commitment_pots
      where user_id = $1 and week_start = $2::date and status = 'active'`,
    [profile.id, week],
  );
  if (!pot) return { error: "Nessun pot attivo" };
  if (pot.payment_ref) await getPaymentProvider().voidPreauth(pot.payment_ref);
  await query(
    `update commitment_pots set status = 'suspended', resolved_at = now() where id = $1`,
    [pot.id],
  );
  revalidatePath("/commitment");
  return { ok: "Pot sospeso (infortunio). Nessun addebito." };
}

/** Resolve active pots against synced activity (admin or self-check). */
export async function resolveCommitmentPots(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const pots = await query<{
    id: string;
    user_id: string;
    week_start: string;
    target_km: number;
    amount_eur: number;
    charity_name: string;
    payment_ref: string | null;
  }>(
    `select * from commitment_pots where status = 'active' and week_start < $1::date
      and ($2::boolean or user_id = $3)`,
    [weekStartUtc(), Boolean(profile.is_admin), profile.id],
  );

  const pay = getPaymentProvider();
  let n = 0;
  for (const pot of pots) {
    const stats = await getWeekStats(pot.user_id, pot.week_start);
    const km = Number(stats?.distance_km ?? 0);
    if (km >= Number(pot.target_km)) {
      if (pot.payment_ref) await pay.voidPreauth(pot.payment_ref);
      await query(
        `update commitment_pots set status = 'succeeded', resolved_at = now() where id = $1`,
        [pot.id],
      );
    } else {
      if (pot.payment_ref) await pay.chargeAndDonate(pot.payment_ref, pot.charity_name);
      await query(
        `update commitment_pots set status = 'failed', resolved_at = now() where id = $1`,
        [pot.id],
      );
    }
    n++;
  }
  revalidatePath("/commitment");
  return { ok: `Risolti ${n} pot` };
}

export async function suggestedTargetForUser(userId: string): Promise<number> {
  const rows = await query<{ distance_km: number }>(
    `select distance_km from weekly_activity_stats
      where user_id = $1 order by week_start desc limit 4`,
    [userId],
  );
  return suggestedWeeklyTarget(rows.map((r) => Number(r.distance_km)));
}
