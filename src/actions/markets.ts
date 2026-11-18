"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { bucketsFromThresholds, parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

const DAILY_MARKET_LIMIT = 10;
const DEFAULT_LIQUIDITY = 100;

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function resolveRace(formData: FormData) {
  const raceId = str(formData, "race_id");
  if (raceId !== "new") {
    const race = await queryOne<{ id: string; upcoming: boolean }>(
      "select id, starts_at > now() as upcoming from races where id = $1",
      [raceId],
    );
    if (!race) throw new Error("Pick a race");
    if (!race.upcoming) throw new Error("This race has already started");
    return race.id;
  }

  const name = str(formData, "new_race_name");
  const startsAt = str(formData, "new_race_starts_at");
  const distance = Number(str(formData, "new_race_distance_km").replace(",", "."));
  if (!name || !startsAt || !(distance > 0)) throw new Error("Fill in the race name, start time and distance");
  if (new Date(startsAt).getTime() <= Date.now()) throw new Error("The race must start in the future");

  const [race] = await query<{ id: string }>(
    "insert into races (name, starts_at, distance_km, location) values ($1, $2, $3, $4) returning id",
    [name, startsAt, distance, str(formData, "new_race_location") || null],
  );
  return race.id;
}

export async function createFriendBet(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in to create a bet" };

  let marketId: string;
  try {
    const athlete = await queryOne<{ id: string }>(
      `select a.id from athletes a
         join strava_accounts s on s.user_id = a.user_id
        where a.id = $1 and a.category = 'friend'`,
      [str(formData, "athlete_id")],
    );
    if (!athlete) throw new Error("Pick a friend who has connected Strava");

    const [{ count }] = await query<{ count: number }>(
      "select count(*)::int as count from markets where created_by = $1 and created_at > now() - interval '1 day'",
      [profile.id],
    );
    if (count >= DAILY_MARKET_LIMIT) throw new Error(`You can create up to ${DAILY_MARKET_LIMIT} bets a day`);

    const kind = str(formData, "kind");
    let outcomes: unknown[] = [];
    let question = "";
    let yesProb = 0.5;
    if (kind === "time") {
      const parts = str(formData, "thresholds").split(",").map((s) => s.trim()).filter(Boolean);
      const seconds = parts.map(parseTime);
      if (seconds.some((s) => s === null)) throw new Error("Invalid time threshold (use mm:ss or h:mm:ss)");
      outcomes = bucketsFromThresholds(seconds as number[]);
      if (outcomes.length < 2) throw new Error("Add at least one time threshold");
    } else if (kind === "custom") {
      question = str(formData, "question");
      yesProb = Number(str(formData, "yes_prob") || 50) / 100;
      if (question.length < 5) throw new Error("Write a longer question");
      if (!(yesProb > 0.01 && yesProb < 0.99)) throw new Error("Initial Yes % must be between 2 and 98");
    } else {
      throw new Error("Pick a bet type");
    }

    const raceId = await resolveRace(formData);
    const [row] =
      kind === "time"
        ? await query<{ id: string }>("select create_market($1, $2, $3, null, $4::jsonb) as id", [
            raceId,
            athlete.id,
            DEFAULT_LIQUIDITY,
            JSON.stringify(outcomes),
          ])
        : await query<{ id: string }>("select create_custom_market($1, $2, $3, $4, null, $5) as id", [
            raceId,
            athlete.id,
            question,
            DEFAULT_LIQUIDITY,
            yesProb,
          ]);
    marketId = row.id;
    await query("update markets set created_by = $2 where id = $1", [marketId, profile.id]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return { error: "There is already a finish-time bet on this friend for this race" };
    }
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }

  revalidatePath("/", "layout");
  redirect(`/markets/${marketId}`);
}
