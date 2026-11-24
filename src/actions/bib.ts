"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatEur } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

export async function registerBib(raceId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in to register" };

  try {
    const race = await queryOne<{ bib_price_eur: number; name: string }>(
      "select bib_price_eur, name from races where id = $1",
      [raceId],
    );
    if (!race) return { error: "Race not found" };
    if (!(Number(race.bib_price_eur) > 0)) return { error: "This race has no bib fee" };

    await query("select register_bib($1, $2)", [profile.id, raceId]);
    revalidatePath("/", "layout");
    return {
      ok: `Bib registered for ${race.name} (${formatEur(Number(race.bib_price_eur))} — simulated). Premium PB refunds go to your PolyRunner EUR wallet.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("Already registered")) return { error: "Already registered for this race" };
    return { error: msg };
  }
}
