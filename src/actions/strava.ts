"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { formatCredits } from "@/lib/format";
import { disconnectAccount, syncWeeklyKm } from "@/lib/strava";
import type { ActionResult } from "@/lib/types";

export async function disconnectStrava(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  try {
    await disconnectAccount(profile.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not disconnect Strava" };
  }
  revalidatePath("/profile");
  return { ok: "Strava disconnected" };
}

export async function refreshWeeklyKm(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  try {
    const result = await syncWeeklyKm(profile.id);
    if (!result) return { error: "Connect Strava first" };
    revalidatePath("/", "layout");
    return {
      ok: `This week: ${result.km} km → ${formatCredits(result.credits)} credits (virtual, non-transferable)`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not sync weekly km" };
  }
}
