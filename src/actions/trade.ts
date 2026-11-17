"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { formatCredits } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Errore sconosciuto";
}

export async function buyShares(outcomeId: string, amount: number): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo non valido" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Devi effettuare il login" };

  try {
    const row = await queryOne<{ r: { shares: number } }>("select buy_shares($1, $2, $3) as r", [
      profile.id,
      outcomeId,
      amount,
    ]);
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
  if (!profile) return { error: "Devi effettuare il login" };

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
