"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseTime } from "@/lib/time";
import type { ActionResult } from "@/lib/types";

const DAILY_MARKET_LIMIT = 10;
const DEFAULT_LIQUIDITY = 100;

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function resolveRace(formData: FormData) {
  const raceId = str(formData, "race_id");
  if (raceId !== "new") {
    const race = await queryOne<{ id: string; upcoming: boolean; distance_km: number }>(
      "select id, starts_at > now() as upcoming, distance_km from races where id = $1",
      [raceId],
    );
    if (!race) throw new Error("Scegli una gara");
    if (!race.upcoming) throw new Error("Questa gara è già iniziata");
    return race;
  }

  const name = str(formData, "new_race_name");
  const startsAt = str(formData, "new_race_starts_at");
  const distance = Number(str(formData, "new_race_distance_km").replace(",", "."));
  if (!name || !startsAt || !(distance > 0)) throw new Error("Compila nome, data e distanza della gara");
  if (new Date(startsAt).getTime() <= Date.now()) throw new Error("La gara deve essere nel futuro");

  const [race] = await query<{ id: string; distance_km: number }>(
    "insert into races (name, starts_at, distance_km, location) values ($1, $2, $3, $4) returning id, distance_km",
    [name, startsAt, distance, str(formData, "new_race_location") || null],
  );
  return { ...race, upcoming: true };
}

async function athleteOwnedBy(athleteId: string, userId: string) {
  return queryOne<{ id: string; user_id: string | null }>(
    `select a.id, a.user_id from athletes a
      where a.id = $1 and a.category = 'friend'
        and (a.user_id = $2
             or exists (
               select 1 from friendships f
                where f.status = 'accepted'
                  and ((f.user_low = $2 and f.user_high = a.user_id)
                    or (f.user_high = $2 and f.user_low = a.user_id))
             ))`,
    [athleteId, userId],
  );
}

export async function createFriendBet(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi per creare una scommessa" };

  let marketId: string;
  try {
    const athlete = await athleteOwnedBy(str(formData, "athlete_id"), profile.id);
    if (!athlete) throw new Error("Scegli te stesso o un amico accettato");

    const [{ count }] = await query<{ count: number }>(
      "select count(*)::int as count from markets where created_by = $1 and created_at > now() - interval '1 day'",
      [profile.id],
    );
    if (count >= DAILY_MARKET_LIMIT) throw new Error(`Puoi creare al massimo ${DAILY_MARKET_LIMIT} scommesse al giorno`);

    const kind = str(formData, "kind");
    let question = "";
    let yesProb = 0.5;
    let goalSeconds: number | null = null;
    const race = await resolveRace(formData);
    const onSelf = athlete.user_id === profile.id;

    if (kind === "time") {
      // exact-time
    } else if (kind === "goal") {
      goalSeconds = parseTime(str(formData, "goal_time"));
      if (!goalSeconds) throw new Error("Obiettivo non valido (usa mm:ss o h:mm:ss)");
      const name = await queryOne<{ name: string }>("select name from athletes where id = $1", [athlete.id]);
      question = `${name?.name ?? "Il runner"} centra sotto ${str(formData, "goal_time")}?`;
      yesProb = Number(str(formData, "yes_prob") || 50) / 100;
      if (!(yesProb > 0.01 && yesProb < 0.99)) throw new Error("Probabilità Sì iniziale tra 2% e 98%");
    } else if (kind === "custom") {
      question = str(formData, "question");
      yesProb = Number(str(formData, "yes_prob") || 50) / 100;
      if (question.length < 5) throw new Error("Scrivi una domanda più lunga");
      if (!(yesProb > 0.01 && yesProb < 0.99)) throw new Error("Probabilità Sì iniziale tra 2% e 98%");
    } else {
      throw new Error("Scegli un tipo di scommessa");
    }

    // Free-text custom on someone else needs runner approval
    const needsApproval = kind === "custom" && !onSelf;
    const approvalStatus = needsApproval ? "pending" : "auto";

    const [row] =
      kind === "time"
        ? await query<{ id: string }>("select create_exact_time_market($1, $2, null) as id", [
            race.id,
            athlete.id,
          ])
        : await query<{ id: string }>("select create_custom_market($1, $2, $3, $4, null, $5) as id", [
            race.id,
            athlete.id,
            question,
            DEFAULT_LIQUIDITY,
            yesProb,
          ]);
    marketId = row.id;
    const stake = str(formData, "stake") === "beer" ? "beer" : "credits";
    await query(
      `update markets set created_by = $2, stake = $3, kind = $4,
          goal_seconds = $5, requires_approval = $6, approval_status = $7
        where id = $1`,
      [
        marketId,
        profile.id,
        stake,
        kind === "goal" ? "goal" : kind === "time" ? "time" : "custom",
        goalSeconds,
        needsApproval,
        approvalStatus,
      ],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return { error: "Esiste già una scommessa sul tempo di questo amico per questa gara" };
    }
    return { error: e instanceof Error ? e.message : "Errore sconosciuto" };
  }

  revalidatePath("/", "layout");
  redirect(`/markets/${marketId}`);
}

async function requireAthleteSubject(marketId: string, userId: string) {
  const row = await queryOne<{ id: string; status: string; starts_at: string }>(
    `select m.id, m.status, r.starts_at
       from markets m
       join athletes a on a.id = m.athlete_id
       join races r on r.id = m.race_id
      where m.id = $1 and a.user_id = $2`,
    [marketId, userId],
  );
  if (!row) throw new Error("Solo il runner soggetto del mercato può farlo");
  return row;
}

export async function approveMarket(marketId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  try {
    await requireAthleteSubject(marketId, profile.id);
    await query(
      `update markets set approval_status = 'approved', requires_approval = false
        where id = $1 and approval_status = 'pending'`,
      [marketId],
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  revalidatePath("/", "layout");
  return { ok: "Mercato approvato" };
}

export async function rejectMarket(marketId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  try {
    await requireAthleteSubject(marketId, profile.id);
    await query(
      `update markets set approval_status = 'rejected', status = 'closed'
        where id = $1 and approval_status = 'pending'`,
      [marketId],
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  revalidatePath("/", "layout");
  return { ok: "Mercato rifiutato" };
}

export async function hideOwnMarket(marketId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  try {
    const m = await requireAthleteSubject(marketId, profile.id);
    if (m.status === "resolved") throw new Error("Il mercato è già risolto");
    if (new Date(m.starts_at) <= new Date()) throw new Error("La gara è già iniziata");
    await query(`update markets set hidden_by_athlete = true where id = $1`, [marketId]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  revalidatePath("/", "layout");
  return { ok: "Mercato nascosto" };
}

export async function closeOwnMarket(marketId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  try {
    const m = await requireAthleteSubject(marketId, profile.id);
    if (m.status !== "open") throw new Error("Il mercato non è aperto");
    if (new Date(m.starts_at) <= new Date()) throw new Error("La gara è già iniziata");
    await query(`update markets set status = 'closed' where id = $1`, [marketId]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  revalidatePath("/", "layout");
  return { ok: "Mercato chiuso" };
}

export async function unhideOwnMarket(marketId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  try {
    await requireAthleteSubject(marketId, profile.id);
    await query(`update markets set hidden_by_athlete = false where id = $1`, [marketId]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Errore" };
  }
  revalidatePath("/", "layout");
  return { ok: "Mercato di nuovo visibile" };
}
