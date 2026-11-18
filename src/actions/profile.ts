"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseEvidence } from "@/lib/evidence";
import { formatTime, parseTime } from "@/lib/time";
import type { ActionResult, EvidenceKind } from "@/lib/types";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function submitPersonalBest(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };

  try {
    const athlete = await queryOne<{ id: string }>(
      "select id from athletes where user_id = $1 and category = 'friend'",
      [profile.id],
    );
    if (!athlete) throw new Error("Join as a runner first");

    const distance = Number(str(formData, "distance_km").replace(",", "."));
    if (!(distance > 0)) throw new Error("Enter the distance in km");

    const seconds = parseTime(str(formData, "time"));
    if (!seconds) throw new Error("Invalid time (use mm:ss or h:mm:ss)");

    const kind = str(formData, "evidence_kind") as EvidenceKind;
    const { evidence_url, photo, photo_type } = await parseEvidence(formData, kind);
    const note = str(formData, "note").slice(0, 280) || null;

    await query(
      `insert into pb_claims
         (athlete_id, user_id, distance_km, time_seconds, evidence_kind, evidence_url, photo, photo_type, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (athlete_id, distance_km) where status = 'pending' do update set
         time_seconds = excluded.time_seconds,
         evidence_kind = excluded.evidence_kind,
         evidence_url = excluded.evidence_url,
         photo = excluded.photo,
         photo_type = excluded.photo_type,
         note = excluded.note,
         created_at = now()`,
      [athlete.id, profile.id, distance, seconds, kind, evidence_url, photo, photo_type, note],
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not submit the personal best" };
  }

  revalidatePath("/profile");
  revalidatePath("/admin");
  return {
    ok: `Personal best submitted (${str(formData, "distance_km")} km · ${str(formData, "time")}). An admin will verify the proof.`,
  };
}

export async function acceptPbClaim(claimId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return { error: "Only admins can do this" };

  const claim = await queryOne<{
    id: string;
    athlete_id: string;
    distance_km: number;
    time_seconds: number;
  }>("select id, athlete_id, distance_km, time_seconds from pb_claims where id = $1 and status = 'pending'", [
    claimId,
  ]);
  if (!claim) return { error: "This personal best is no longer pending" };

  await query(
    `update pb_claims set status = 'accepted', reviewed_by = $2, reviewed_at = now() where id = $1`,
    [claim.id, profile.id],
  );
  await query(
    `insert into athlete_pbs (athlete_id, distance_km, time_seconds, claim_id, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (athlete_id, distance_km) do update set
       time_seconds = excluded.time_seconds,
       claim_id = excluded.claim_id,
       updated_at = now()`,
    [claim.athlete_id, claim.distance_km, claim.time_seconds, claim.id],
  );
  // Keep the legacy single PB column in sync with the fastest verified PB (best pace).
  await query(
    `update athletes a
        set personal_best_seconds = (
          select p.time_seconds from athlete_pbs p
           where p.athlete_id = a.id
           order by p.time_seconds / p.distance_km
           limit 1
        )
      where a.id = $1`,
    [claim.athlete_id],
  );

  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/create");
  return {
    ok: `Verified ${Number(claim.distance_km)} km PB: ${formatTime(claim.time_seconds)}`,
  };
}

export async function rejectPbClaim(claimId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) return { error: "Only admins can do this" };
  await query(
    `update pb_claims set status = 'rejected', reviewed_by = $2, reviewed_at = now()
      where id = $1 and status = 'pending'`,
    [claimId, profile.id],
  );
  revalidatePath("/admin");
  revalidatePath("/profile");
  return { ok: "Personal best rejected" };
}
