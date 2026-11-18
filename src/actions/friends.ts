"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

export async function addFriend(athleteId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in to add friends" };
  const athlete = await queryOne<{ name: string }>(
    "select name from athletes where id = $1 and category = 'friend' and user_id is distinct from $2",
    [athleteId, profile.id],
  );
  if (!athlete) return { error: "Runner not found" };

  await query("insert into follows (user_id, athlete_id) values ($1, $2) on conflict do nothing", [
    profile.id,
    athleteId,
  ]);
  revalidatePath("/", "layout");
  return { ok: `${athlete.name} added to your friends` };
}

export async function removeFriend(athleteId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  await query("delete from follows where user_id = $1 and athlete_id = $2", [profile.id, athleteId]);
  revalidatePath("/", "layout");
  return { ok: "Removed from your friends" };
}
