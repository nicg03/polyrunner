"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { formatCredits } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Unknown error";
}

export async function buyShares(outcomeId: string, amount: number): Promise<ActionResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Invalid amount" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You need to log in" };

  try {
    const row = await queryOne<{ r: { shares: number } }>("select buy_shares($1, $2, $3) as r", [
      profile.id,
      outcomeId,
      amount,
    ]);
    revalidatePath("/", "layout");
    return {
      ok: `Bought ${Number(row!.r.shares).toFixed(2)} shares for ${formatCredits(amount)} credits`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function sellShares(outcomeId: string, shares: number): Promise<ActionResult> {
  if (!Number.isFinite(shares) || shares <= 0) return { error: "Invalid shares" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You need to log in" };

  try {
    const row = await queryOne<{ r: { proceeds: number } }>("select sell_shares($1, $2, $3) as r", [
      profile.id,
      outcomeId,
      shares,
    ]);
    revalidatePath("/", "layout");
    return {
      ok: `Sold ${shares.toFixed(2)} shares for ${formatCredits(row!.r.proceeds)} credits`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
