"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCredits } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

export async function buyShares(outcomeId: string, amount: number): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo non valido" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buy_shares", {
    p_outcome_id: outcomeId,
    p_amount: amount,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: `Comprate ${Number(data.shares).toFixed(2)} quote per ${formatCredits(amount)} crediti` };
}

export async function sellShares(outcomeId: string, shares: number): Promise<ActionResult> {
  if (!Number.isFinite(shares) || shares <= 0) return { error: "Quote non valide" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_shares", {
    p_outcome_id: outcomeId,
    p_shares: shares,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: `Vendute ${shares.toFixed(2)} quote per ${formatCredits(data.proceeds)} crediti` };
}
