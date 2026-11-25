"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatCredits } from "@/lib/format";
import { maybeAwardReferralBonus } from "@/lib/referrals";
import { parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

export async function placeTimePrediction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi per fare un pronostico" };

  const marketId = String(formData.get("market_id") ?? "").trim();
  const predicted = parseTime(String(formData.get("predicted_time") ?? "").trim());
  const stake = Number(String(formData.get("stake") ?? "").replace(",", "."));

  if (!marketId) return { error: "Mercato mancante" };
  if (!predicted) return { error: "Tempo non valido (usa mm:ss o h:mm:ss)" };
  if (!(stake > 0)) return { error: "La puntata deve essere positiva" };

  try {
    const m = await queryOne<{
      athlete_user_id: string | null;
      personal_best_seconds: number | null;
      goal_seconds: number | null;
      approval_status: string;
      hidden_by_athlete: boolean;
    }>(
      `select a.user_id as athlete_user_id, a.personal_best_seconds, m.goal_seconds,
              coalesce(m.approval_status, 'auto') as approval_status,
              coalesce(m.hidden_by_athlete, false) as hidden_by_athlete
         from markets m
         left join athletes a on a.id = m.athlete_id
        where m.id = $1`,
      [marketId],
    );
    if (!m) return { error: "Mercato non trovato" };
    if (m.hidden_by_athlete || (m.approval_status !== "auto" && m.approval_status !== "approved")) {
      return { error: "Questo mercato non è ancora pubblico" };
    }

    // Self: only predict times faster than PB / at-or-under goal
    if (m.athlete_user_id === profile.id) {
      if (m.personal_best_seconds != null && predicted >= m.personal_best_seconds) {
        return { error: "Sul tuo mercato puoi pronosticare solo un tempo più veloce del PB" };
      }
      if (m.goal_seconds != null && predicted > m.goal_seconds) {
        return { error: "Sul tuo mercato puoi pronosticare solo di centrare l'obiettivo" };
      }
    }

    await query("select place_time_prediction($1, $2, $3, $4)", [
      profile.id,
      marketId,
      predicted,
      stake,
    ]);
    await maybeAwardReferralBonus(profile.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    if (msg.includes("Insufficient balance")) return { error: "Saldo insufficiente" };
    if (msg.includes("already placed")) return { error: "Hai già fatto un pronostico su questo mercato" };
    return { error: msg };
  }

  revalidatePath("/", "layout");
  return { ok: `Pronostico bloccato per ${formatCredits(stake)} crediti` };
}
