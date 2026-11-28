"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatEur } from "@/lib/format";
import type { ActionResult } from "@/lib/types";

export async function registerBib(raceId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi per registrare il pettorale" };

  try {
    const race = await queryOne<{ bib_price_eur: number; name: string }>(
      "select bib_price_eur, name from races where id = $1",
      [raceId],
    );
    if (!race) return { error: "Gara non trovata" };
    if (!(Number(race.bib_price_eur) > 0)) return { error: "Questa gara non ha quota pettorale" };

    await query("select register_bib($1, $2)", [profile.id, raceId]);
    revalidatePath("/", "layout");
    return {
      ok: `Pettorale registrato per ${race.name} (${formatEur(Number(race.bib_price_eur))} — simulato). I rimborsi PB Premium vanno sul wallet EUR PolyRunner.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    if (msg.includes("Already registered")) return { error: "Pettorale già registrato per questa gara" };
    return { error: msg };
  }
}