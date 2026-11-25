"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { formatCredits } from "@/lib/format";
import { maybeAwardReferralBonus } from "@/lib/referrals";
import type { ActionResult } from "@/lib/types";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Errore sconosciuto";
}

/** Runner on themselves may only buy faster brackets or Yes on goal markets. */
async function assertSelfTradeAllowed(userId: string, outcomeId: string) {
  const row = await queryOne<{
    athlete_user_id: string | null;
    kind: string;
    label: string;
    max_seconds: number | null;
    min_seconds: number | null;
    goal_seconds: number | null;
    personal_best_seconds: number | null;
  }>(
    `select a.user_id as athlete_user_id, m.kind, o.label, o.max_seconds, o.min_seconds,
            m.goal_seconds, a.personal_best_seconds
       from outcomes o
       join markets m on m.id = o.market_id
       left join athletes a on a.id = m.athlete_id
      where o.id = $1`,
    [outcomeId],
  );
  if (!row || row.athlete_user_id !== userId) return;

  if (row.kind === "goal" || row.kind === "custom") {
    if (row.label.toLowerCase() === "no") {
      throw new Error("Sul tuo mercato puoi comprare solo Sì (esito positivo)");
    }
    return;
  }

  // Time brackets: only buy outcomes that imply a faster finish than PB (or open-ended fast end)
  const pb = row.personal_best_seconds;
  if (pb != null && row.min_seconds != null && row.min_seconds >= pb) {
    throw new Error("Puoi comprare solo fasce più veloci del tuo personale");
  }
  if (pb != null && row.max_seconds != null && row.max_seconds > pb && row.min_seconds != null && row.min_seconds >= pb) {
    throw new Error("Puoi comprare solo fasce più veloci del tuo personale");
  }
}

export async function buyShares(outcomeId: string, amount: number): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo non valido" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Devi accedere" };

  try {
    await assertSelfTradeAllowed(profile.id, outcomeId);
    const row = await queryOne<{ r: { shares: number } }>("select buy_shares($1, $2, $3) as r", [
      profile.id,
      outcomeId,
      amount,
    ]);
    await maybeAwardReferralBonus(profile.id);
    revalidatePath("/", "layout");
    return {
      ok: `Comprate ${Number(row!.r.shares).toFixed(2)} quote per ${formatCredits(amount)} crediti`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function sellShares(outcomeId: string, shares: number): Promise<ActionResult> {
  if (!Number.isFinite(shares) || shares <= 0) return { error: "Quote non valide" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Devi accedere" };

  try {
    const row = await queryOne<{ r: { proceeds: number } }>("select sell_shares($1, $2, $3) as r", [
      profile.id,
      outcomeId,
      shares,
    ]);
    revalidatePath("/", "layout");
    return {
      ok: `Vendute ${shares.toFixed(2)} quote per ${formatCredits(row!.r.proceeds)} crediti`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
