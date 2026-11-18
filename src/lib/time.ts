// "mm:ss" or "h:mm:ss" -> seconds. Returns null if the format is invalid.
export function parseTime(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => !/^\d+$/.test(p))) return null;

  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (s >= 60 || (nums.length === 3 && m >= 60)) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatPace(totalSeconds: number, distanceKm: number): string {
  return `${formatTime(totalSeconds / distanceKm)}/km`;
}

export interface BucketDraft {
  label: string;
  min_seconds: number | null;
  max_seconds: number | null;
}

// Sorted thresholds -> brackets: "< t0", "t0 - t1", ..., "> tn".
export function bucketsFromThresholds(thresholds: number[]): BucketDraft[] {
  const sorted = [...new Set(thresholds)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const buckets: BucketDraft[] = [
    { label: `< ${formatTime(sorted[0])}`, min_seconds: null, max_seconds: sorted[0] },
  ];
  for (let i = 0; i < sorted.length - 1; i++) {
    buckets.push({
      label: `${formatTime(sorted[i])} - ${formatTime(sorted[i + 1])}`,
      min_seconds: sorted[i],
      max_seconds: sorted[i + 1],
    });
  }
  const last = sorted[sorted.length - 1];
  buckets.push({ label: `> ${formatTime(last)}`, min_seconds: last, max_seconds: null });
  return buckets;
}
