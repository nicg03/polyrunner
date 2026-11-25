"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function createClub(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (name.length < 3) return { error: "Nome club troppo corto" };

  let slug = slugify(name) || `club-${Date.now()}`;
  const clash = await queryOne("select 1 from clubs where slug = $1", [slug]);
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

  const [club] = await query<{ id: string; slug: string }>(
    `insert into clubs (name, slug, description, created_by)
     values ($1, $2, $3, $4) returning id, slug`,
    [name, slug, description, profile.id],
  );
  await query(
    `insert into club_members (club_id, user_id, role) values ($1, $2, 'owner')`,
    [club.id, profile.id],
  );

  revalidatePath("/clubs");
  redirect(`/clubs/${club.slug}`);
}

export async function joinClub(clubId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  await query(
    `insert into club_members (club_id, user_id, role) values ($1, $2, 'member')
     on conflict do nothing`,
    [clubId, profile.id],
  );
  revalidatePath("/clubs");
  return { ok: "Sei nel club" };
}

export async function leaveClub(clubId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };
  await query(`delete from club_members where club_id = $1 and user_id = $2 and role <> 'owner'`, [
    clubId,
    profile.id,
  ]);
  revalidatePath("/clubs");
  return { ok: "Hai lasciato il club" };
}

/** Create a km-vs-km challenge between two clubs for the current week. */
export async function createClubChallenge(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const clubA = String(formData.get("club_a") ?? "");
  const clubB = String(formData.get("club_b") ?? "");
  if (!clubA || !clubB || clubA === clubB) return { error: "Scegli due club diversi" };

  const member = await queryOne(
    `select 1 from club_members where club_id = $1 and user_id = $2`,
    [clubA, profile.id],
  );
  if (!member) return { error: "Devi essere membro del primo club" };

  const [a, b] = await Promise.all([
    queryOne<{ name: string }>("select name from clubs where id = $1", [clubA]),
    queryOne<{ name: string }>("select name from clubs where id = $1", [clubB]),
  ]);
  if (!a || !b) return { error: "Club non trovato" };

  const weekStart = new Date();
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  const week = weekStart.toISOString().slice(0, 10);

  let race = await queryOne<{ id: string }>(
    `select id from races where name = $1 limit 1`,
    [`Sfida club ${week}`],
  );
  if (!race) {
    const [r] = await query<{ id: string }>(
      `insert into races (name, starts_at, distance_km, location)
       values ($1, ($2::date + 7)::timestamptz, 0, 'Club') returning id`,
      [`Sfida club ${week}`, week],
    );
    race = r;
  }

  const question = `Il gruppo ${a.name} farà più km del gruppo ${b.name} questa settimana?`;
  const [m] = await query<{ id: string }>(
    `select create_custom_market($1, null, $2, 100, ($3::date + 7)::timestamptz, 0.5) as id`,
    [race.id, question, week],
  );
  await query(
    `update markets set club_id = $2, week_start = $3::date, created_by = $4,
        meta = jsonb_build_object('club_a', $2::text, 'club_b', $5::text),
        approval_status = 'auto'
      where id = $1`,
    [m.id, clubA, week, profile.id, clubB],
  );

  revalidatePath("/clubs");
  redirect(`/markets/${m.id}`);
}
