import type { EvidenceKind } from "@/lib/types";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const STRAVA_ACTIVITY_URL =
  /^https:\/\/((www\.)?strava\.com\/activities\/\d+|strava\.app\.link\/\w+)/i;

export function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Parses evidence fields from a form. Throws a user-facing Error on bad input. */
export async function parseEvidence(formData: FormData, kind: EvidenceKind) {
  let evidence_url: string | null = null;
  let photo: Buffer | null = null;
  let photo_type: string | null = null;

  if (kind === "strava") {
    evidence_url = String(formData.get("evidence_url") ?? "").trim();
    if (!STRAVA_ACTIVITY_URL.test(evidence_url)) {
      throw new Error("Paste the link of the Strava activity");
    }
  } else if (kind === "official") {
    evidence_url = httpUrl(String(formData.get("evidence_url") ?? "").trim());
    if (!evidence_url) throw new Error("Paste a valid link to the results or proof page");
  } else if (kind === "photo") {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new Error("Add a photo of your watch");
    if (!PHOTO_TYPES.has(file.type)) throw new Error("Use a JPG, PNG or WebP photo");
    if (file.size > MAX_PHOTO_BYTES) throw new Error("The photo is too large (max 5 MB)");
    photo = Buffer.from(await file.arrayBuffer());
    photo_type = file.type;
  } else {
    throw new Error("Pick a type of proof");
  }

  return { evidence_url, photo, photo_type };
}
