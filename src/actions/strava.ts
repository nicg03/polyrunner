"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { disconnectAccount } from "@/lib/strava";
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
