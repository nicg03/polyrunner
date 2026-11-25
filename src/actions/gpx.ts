"use server";

import { getCurrentProfile } from "@/lib/auth";
import { checkTrack, parseGpxPoints } from "@/lib/antifraud";
import type { ActionResult } from "@/lib/types";

/** Light GPX validation for virtual-credit fallback uploads. Not allowed for Commitment Pot. */
export async function validateGpxUpload(formData: FormData): Promise<ActionResult & { risk?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Accedi" };

  const file = formData.get("gpx");
  if (!(file instanceof File)) return { error: "Carica un file GPX" };
  if (file.size > 5_000_000) return { error: "File troppo grande" };

  const text = await file.text();
  if (!/<gpx/i.test(text)) return { error: "File GPX non valido" };

  const points = parseGpxPoints(text);
  const check = checkTrack(points);
  if (!check.ok) {
    return {
      error: `Traccia rifiutata (${check.risk}): ${check.reasons.join("; ")}`,
      risk: check.risk,
    };
  }
  return {
    ok: `GPX ok (${points.length} punti, rischio ${check.risk}). Usabile solo per crediti virtuali, non per Commitment Pot.`,
    risk: check.risk,
  };
}
