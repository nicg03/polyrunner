"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { formatTime, parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

async function adminClient() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Solo gli admin possono farlo");
  return createClient();
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const ok = await fn();
    revalidatePath("/", "layout");
    return { ok };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore sconosciuto" };
  }
}

export async function createRace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const supabase = await adminClient();
    const name = str(formData, "name");
    const startsAt = str(formData, "starts_at");
    const distance = Number(str(formData, "distance_km").replace(",", "."));
    if (!name || !startsAt || !(distance > 0)) throw new Error("Compila nome, data e distanza");

    const { error } = await supabase.from("races").insert({
      name,
      starts_at: startsAt,
      distance_km: distance,
      location: str(formData, "location") || null,
    });
    if (error) throw new Error(error.message);
    return `Gara "${name}" creata`;
  });
}

export async function createAthlete(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const supabase = await adminClient();
    const name = str(formData, "name");
    if (!name) throw new Error("Inserisci il nome");
    const pbRaw = str(formData, "personal_best");
    const pb = pbRaw ? parseTime(pbRaw) : null;
    if (pbRaw && pb === null) throw new Error("Personal best non valido (usa mm:ss o h:mm:ss)");

    const { error } = await supabase.from("athletes").insert({
      name,
      personal_best_seconds: pb,
      bio: str(formData, "bio") || null,
      avatar_url: str(formData, "avatar_url") || null,
    });
    if (error) throw new Error(error.message);
    return `Atleta "${name}" aggiunto`;
  });
}

export async function createMarket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const supabase = await adminClient();
    const raceId = str(formData, "race_id");
    const athleteId = str(formData, "athlete_id");
    const b = Number(str(formData, "liquidity_b") || 100);
    const outcomes = JSON.parse(str(formData, "outcomes") || "[]");
    if (!raceId || !athleteId) throw new Error("Scegli gara e atleta");
    if (!Array.isArray(outcomes) || outcomes.length < 2) throw new Error("Servono almeno 2 fasce");

    const { error } = await supabase.rpc("create_market", {
      p_race_id: raceId,
      p_athlete_id: athleteId,
      p_liquidity_b: b,
      p_closes_at: str(formData, "closes_at") || null,
      p_outcomes: outcomes,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Esiste già un mercato per questo atleta in questa gara");
      throw new Error(error.message);
    }
    return "Mercato creato";
  });
}

export async function closeMarket(marketId: string): Promise<ActionResult> {
  return run(async () => {
    const supabase = await adminClient();
    const { error } = await supabase.from("markets").update({ status: "closed" }).eq("id", marketId);
    if (error) throw new Error(error.message);
    return "Mercato chiuso alle giocate";
  });
}

export async function reopenMarket(marketId: string): Promise<ActionResult> {
  return run(async () => {
    const supabase = await adminClient();
    const { error } = await supabase
      .from("markets")
      .update({ status: "open" })
      .eq("id", marketId)
      .neq("status", "resolved");
    if (error) throw new Error(error.message);
    return "Mercato riaperto";
  });
}

export async function resolveMarket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const supabase = await adminClient();
    const marketId = str(formData, "market_id");
    const seconds = parseTime(str(formData, "actual_time"));
    if (!seconds) throw new Error("Tempo non valido (usa mm:ss o h:mm:ss)");

    const { error } = await supabase.rpc("resolve_market", {
      p_market_id: marketId,
      p_actual_time_seconds: seconds,
    });
    if (error) throw new Error(error.message);
    return `Mercato risolto con tempo ${formatTime(seconds)}`;
  });
}
