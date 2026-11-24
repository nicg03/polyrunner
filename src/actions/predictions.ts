"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatCredits } from "@/lib/format";
import { parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

export async function placeTimePrediction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in to place a prediction" };

  const marketId = String(formData.get("market_id") ?? "").trim();
  const predicted = parseTime(String(formData.get("predicted_time") ?? "").trim());
  const stake = Number(String(formData.get("stake") ?? "").replace(",", "."));

  if (!marketId) return { error: "Missing market" };
  if (!predicted) return { error: "Invalid predicted time (use mm:ss or h:mm:ss)" };
  if (!(stake > 0)) return { error: "Stake must be positive" };

  try {
    await query("select place_time_prediction($1, $2, $3, $4)", [
      profile.id,
      marketId,
      predicted,
      stake,
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("Insufficient balance")) return { error: "Insufficient balance" };
    if (msg.includes("already placed")) return { error: "You already placed a prediction on this market" };
    return { error: msg };
  }

  revalidatePath("/", "layout");
  return { ok: `Prediction locked for ${formatCredits(stake)} credits` };
}
