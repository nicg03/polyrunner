"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

export async function trackAffiliateClick(raceId: string): Promise<{ url: string | null }> {
  const profile = await getCurrentProfile();
  const race = await queryOne<{ affiliate_url: string | null }>(
    `select affiliate_url from races where id = $1`,
    [raceId],
  );
  if (!race?.affiliate_url) return { url: null };
  await query(
    `insert into affiliate_clicks (race_id, user_id) values ($1, $2)`,
    [raceId, profile?.id ?? null],
  );
  return { url: race.affiliate_url };
}

export async function createPrize(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return { error: "Solo admin" };

  const raceId = String(formData.get("race_id") ?? "").trim() || null;
  const sponsor = String(formData.get("sponsor_name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!sponsor || !title) return { error: "Sponsor e titolo obbligatori" };

  await query(
    `insert into prizes (race_id, sponsor_name, title, description)
     values ($1, $2, $3, $4)`,
    [raceId, sponsor, title, description],
  );
  revalidatePath("/admin");
  return { ok: "Premio creato" };
}

export async function awardPrize(prizeId: string, userId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return { error: "Solo admin" };
  await query(
    `update prizes set awarded_to = $2, awarded_at = now() where id = $1`,
    [prizeId, userId],
  );
  revalidatePath("/admin");
  return { ok: "Premio assegnato (fisico, senza conversione crediti)" };
}

export async function stubPremiumCheckout(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  if (profile.is_premium) return { ok: "Sei già Premium" };

  await query(
    `insert into premium_checkout_stubs (user_id, amount_eur, status)
     values ($1, 4.99, 'completed')`,
    [profile.id],
  );
  await query(`update users set is_premium = true where id = $1`, [profile.id]);
  revalidatePath("/premium");
  return { ok: "Premium attivato (pagamento simulato — stub)" };
}

export async function updateRaceCommerce(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return { error: "Solo admin" };
  const raceId = String(formData.get("race_id") ?? "");
  await query(
    `update races set
       organizer_sponsor = $2,
       pb_refund_budget_eur = $3,
       affiliate_url = $4
     where id = $1`,
    [
      raceId,
      String(formData.get("organizer_sponsor") ?? "").trim() || null,
      Number(String(formData.get("pb_refund_budget_eur") ?? "0").replace(",", ".")) || 0,
      String(formData.get("affiliate_url") ?? "").trim() || null,
    ],
  );
  revalidatePath("/admin");
  revalidatePath("/races");
  return { ok: "Gara aggiornata" };
}

export async function contestResult(
  claimId: string,
  note: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  await query(
    `update result_claims
        set contested_by = $2, contested_at = now(), contest_note = $3
      where id = $1 and status = 'accepted'`,
    [claimId, profile.id, note.slice(0, 500)],
  );
  revalidatePath("/admin");
  return { ok: "Contestazione inviata: in coda per revisione admin" };
}

export async function importOfficialResult(
  marketId: string,
  bib: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return { error: "Solo admin" };

  const { getOfficialResultsProvider } = await import("@/lib/official-results");
  const market = await queryOne<{ race_name: string }>(
    `select r.name as race_name from markets m join races r on r.id = m.race_id where m.id = $1`,
    [marketId],
  );
  if (!market) return { error: "Mercato non trovato" };

  const result = await getOfficialResultsProvider().lookup(market.race_name, bib);
  if (!result?.timeSeconds) {
    return {
      error:
        "Nessun risultato (stub). Usa pettorale DEMO-mmss es. DEMO-9520 per 1:35:20, oppure risolvi a mano.",
    };
  }

  await query(`select resolve_market($1, $2)`, [marketId, result.timeSeconds]);
  await query(`select * from award_athlete_bonus($1)`, [marketId]);
  revalidatePath("/", "layout");
  return { ok: `Importato da classifica stub: ${result.timeSeconds}s (fonte ${result.source})` };
}
