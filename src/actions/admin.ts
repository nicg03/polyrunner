"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatTime, parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Solo gli admin possono farlo");
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const ok = await fn();
    revalidatePath("/", "layout");
    return { ok };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return { error: "Esiste già un mercato per questo atleta in questa gara" };
    }
    return { error: e instanceof Error ? e.message : "Errore sconosciuto" };
  }
}

export async function createRace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const name = str(formData, "name");
    const startsAt = str(formData, "starts_at");
    const distance = Number(str(formData, "distance_km").replace(",", "."));
    if (!name || !startsAt || !(distance > 0)) throw new Error("Compila nome, data e distanza");

    await query(
      "insert into races (name, starts_at, distance_km, location) values ($1, $2, $3, $4)",
      [name, startsAt, distance, str(formData, "location") || null],
    );
    return `Gara "${name}" creata`;
  });
}

export async function createAthlete(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const name = str(formData, "name");
    if (!name) throw new Error("Inserisci il nome");
    const pbRaw = str(formData, "personal_best");
    const pb = pbRaw ? parseTime(pbRaw) : null;
    if (pbRaw && pb === null) throw new Error("Personal best non valido (usa mm:ss o h:mm:ss)");

    await query(
      "insert into athletes (name, personal_best_seconds, bio, avatar_url) values ($1, $2, $3, $4)",
      [name, pb, str(formData, "bio") || null, str(formData, "avatar_url") || null],
    );
    return `Atleta "${name}" aggiunto`;
  });
}

export async function createMarket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const raceId = str(formData, "race_id");
    const athleteId = str(formData, "athlete_id");
    const b = Number(str(formData, "liquidity_b") || 100);
    const outcomes = JSON.parse(str(formData, "outcomes") || "[]");
    if (!raceId || !athleteId) throw new Error("Scegli gara e atleta");
    if (!Array.isArray(outcomes) || outcomes.length < 2) throw new Error("Servono almeno 2 fasce");
    if (!(b > 0)) throw new Error("Liquidità non valida");

    await query("select create_market($1, $2, $3, $4, $5::jsonb)", [
      raceId,
      athleteId,
      b,
      str(formData, "closes_at") || null,
      JSON.stringify(outcomes),
    ]);
    return "Mercato creato";
  });
}

export async function closeMarket(marketId: string): Promise<ActionResult> {
  return run(async () => {
    await query("update markets set status = 'closed' where id = $1 and status = 'open'", [marketId]);
    return "Mercato chiuso alle giocate";
  });
}

export async function reopenMarket(marketId: string): Promise<ActionResult> {
  return run(async () => {
    await query("update markets set status = 'open' where id = $1 and status = 'closed'", [marketId]);
    return "Mercato riaperto";
  });
}

export async function resolveMarket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const marketId = str(formData, "market_id");
    const seconds = parseTime(str(formData, "actual_time"));
    if (!seconds) throw new Error("Tempo non valido (usa mm:ss o h:mm:ss)");

    await query("select resolve_market($1, $2)", [marketId, seconds]);
    return `Mercato risolto con tempo ${formatTime(seconds)}`;
  });
}
