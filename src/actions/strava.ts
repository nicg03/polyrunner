"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { formatCredits } from "@/lib/format";
import { disconnectAccount, syncWeeklyKm } from "@/lib/strava";
import type { ActionResult } from "@/lib/types";

export async function disconnectStrava(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Devi accedere" };
  try {
    await disconnectAccount(profile.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossibile scollegare Strava" };
  }
  revalidatePath("/profile");
  return { ok: "Strava scollegato" };
}

export async function refreshWeeklyKm(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Devi accedere" };
  try {
    const result = await syncWeeklyKm(profile.id);
    if (!result) return { error: "Collega prima Strava" };
    revalidatePath("/", "layout");
    return {
      ok: `Questa settimana: ${result.km} km → ${formatCredits(result.credits)} crediti (virtuali, non trasferibili)`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossibile sincronizzare i km settimanali" };
  }
}
