"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseEvidence } from "@/lib/evidence";
import { parseTime } from "@/lib/time";
import type { ActionResult, EvidenceKind } from "@/lib/types";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function submitResult(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi per inviare un risultato" };

  const marketId = str(formData, "market_id");
  try {
    const market = await queryOne<{ status: string; started: boolean }>(
      `select m.status, r.starts_at <= now() as started
         from markets m join races r on r.id = m.race_id
        where m.id = $1 and m.kind = 'time'`,
      [marketId],
    );
    if (!market) throw new Error("Mercato non trovato");
    if (market.status === "resolved") throw new Error("Questo mercato è già risolto");
    if (!market.started) throw new Error("Puoi inviare il risultato quando la gara è iniziata");

    const seconds = parseTime(str(formData, "time"));
    if (!seconds) throw new Error("Tempo non valido (usa mm:ss o h:mm:ss)");

    const kind = str(formData, "evidence_kind") as EvidenceKind;
    const { evidence_url, photo, photo_type } = await parseEvidence(formData, kind);
    const note = str(formData, "note").slice(0, 280) || null;

    await query(
      `insert into result_claims (market_id, user_id, time_seconds, evidence_kind, evidence_url, photo, photo_type, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (market_id, user_id) where status = 'pending' do update set
         time_seconds = excluded.time_seconds,
         evidence_kind = excluded.evidence_kind,
         evidence_url = excluded.evidence_url,
         photo = excluded.photo,
         photo_type = excluded.photo_type,
         note = excluded.note,
         created_at = now()`,
      [marketId, profile.id, seconds, kind, evidence_url, photo, photo_type, note],
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossibile inviare il risultato" };
  }

  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/admin");
  return { ok: "Risultato inviato. Un admin verificherà la prova e liquidarà il mercato." };
}

/** Puts the current user in the Friends section, so anyone can create bets on their races. */
export async function joinAsRunner(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Devi accedere" };
  await query(
    `insert into athletes (name, user_id, avatar_url, category)
     select u.username, u.id, u.avatar_url, 'friend' from users u
      where u.id = $1 and not exists (select 1 from athletes a where a.user_id = $1)`,
    [profile.id],
  );
  revalidatePath("/", "layout");
  return { ok: "Sei tra gli amici runner: ora chiunque può scommettere sulle tue gare" };
}
