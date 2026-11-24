import "server-only";
import { query, queryOne } from "@/lib/db";

export async function getAppSetting(key: string, fallback: string) {
  const row = await queryOne<{ value: string }>("select value from app_settings where key = $1", [key]);
  return row?.value ?? fallback;
}

export async function predictionParams() {
  const [maxError, mult] = await Promise.all([
    getAppSetting("prediction_max_error_seconds", "600"),
    getAppSetting("prediction_max_multiplier", "2"),
  ]);
  return {
    maxErrorSeconds: Number(maxError) || 600,
    maxMultiplier: Number(mult) || 2,
  };
}

/** Monday (UTC date) of the ISO week containing `d`. */
export function weekStartUtc(d = new Date()): string {
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

export async function maybeUnlockPremium(userId: string) {
  await query("select maybe_unlock_premium($1)", [userId]);
}
