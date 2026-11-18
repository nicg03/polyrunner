"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatTime, parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) throw new Error("Only admins can do this");
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
      return { error: "This athlete already has a finish-time market in this race" };
    }
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function createRace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const name = str(formData, "name");
    const startsAt = str(formData, "starts_at");
    const distance = Number(str(formData, "distance_km").replace(",", "."));
    if (!name || !startsAt || !(distance > 0)) throw new Error("Fill in name, date and distance");

    await query(
      "insert into races (name, starts_at, distance_km, location) values ($1, $2, $3, $4)",
      [name, startsAt, distance, str(formData, "location") || null],
    );
    return `Race "${name}" created`;
  });
}

export async function createAthlete(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const name = str(formData, "name");
    if (!name) throw new Error("Enter a name");
    const pbRaw = str(formData, "personal_best");
    const pb = pbRaw ? parseTime(pbRaw) : null;
    if (pbRaw && pb === null) throw new Error("Invalid personal best (use mm:ss or h:mm:ss)");

    await query(
      "insert into athletes (name, personal_best_seconds, bio, avatar_url) values ($1, $2, $3, $4)",
      [name, pb, str(formData, "bio") || null, str(formData, "avatar_url") || null],
    );
    return `Athlete "${name}" added`;
  });
}

export async function createMarket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const raceId = str(formData, "race_id");
    const athleteId = str(formData, "athlete_id");
    const b = Number(str(formData, "liquidity_b") || 100);
    const outcomes = JSON.parse(str(formData, "outcomes") || "[]");
    if (!raceId || !athleteId) throw new Error("Pick a race and an athlete");
    if (!Array.isArray(outcomes) || outcomes.length < 2) throw new Error("At least 2 brackets are required");
    if (!(b > 0)) throw new Error("Invalid liquidity");

    await query("select create_market($1, $2, $3, $4, $5::jsonb)", [
      raceId,
      athleteId,
      b,
      str(formData, "closes_at") || null,
      JSON.stringify(outcomes),
    ]);
    return "Market created";
  });
}

export async function createCustomMarket(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const raceId = str(formData, "race_id");
    const question = str(formData, "question");
    const b = Number(str(formData, "liquidity_b") || 100);
    const yesPct = Number(str(formData, "yes_prob") || 50);
    if (!raceId) throw new Error("Pick a race");
    if (question.length < 5) throw new Error("Write a longer question");
    if (!(b > 0)) throw new Error("Invalid liquidity");

    await query("select create_custom_market($1, $2, $3, $4, $5, $6)", [
      raceId,
      str(formData, "athlete_id") || null,
      question,
      b,
      str(formData, "closes_at") || null,
      yesPct / 100,
    ]);
    return "Yes/No market created";
  });
}

export async function closeMarket(marketId: string): Promise<ActionResult> {
  return run(async () => {
    await query("update markets set status = 'closed' where id = $1 and status = 'open'", [marketId]);
    return "Trading closed";
  });
}

export async function reopenMarket(marketId: string): Promise<ActionResult> {
  return run(async () => {
    await query("update markets set status = 'open' where id = $1 and status = 'closed'", [marketId]);
    return "Market reopened";
  });
}

export async function resolveMarket(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const marketId = str(formData, "market_id");
    const seconds = parseTime(str(formData, "actual_time"));
    if (!seconds) throw new Error("Invalid time (use mm:ss or h:mm:ss)");

    await query("select resolve_market($1, $2)", [marketId, seconds]);
    return `Market resolved with a time of ${formatTime(seconds)}`;
  });
}

export async function resolveMarketOutcome(marketId: string, outcomeId: string): Promise<ActionResult> {
  return run(async () => {
    const [row] = await query<{ label: string }>(
      "select o.label from outcomes o where o.id = $1 and o.market_id = $2",
      [outcomeId, marketId],
    );
    await query("select resolve_market_outcome($1, $2)", [marketId, outcomeId]);
    return `Market resolved: ${row?.label ?? "done"}`;
  });
}
