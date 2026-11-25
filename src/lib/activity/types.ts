export interface ActivitySummary {
  runsCount: number;
  distanceKm: number;
  lastActivityAt: string | null;
}

export interface ActivityProvider {
  id: "mock" | "garmin" | "polar" | "coros" | "suunto" | "healthkit";
  label: string;
  connect(userId: string): Promise<{ ok: true } | { error: string }>;
  disconnect(userId: string): Promise<void>;
  syncWeek(userId: string, weekStart: string): Promise<ActivitySummary>;
}

export function suggestedWeeklyTarget(last4WeeksKm: number[]): number {
  if (last4WeeksKm.length === 0) return 20;
  const avg = last4WeeksKm.reduce((a, b) => a + b, 0) / last4WeeksKm.length;
  return Math.round(avg * 10) / 10;
}

/** Cap weekly target increase at +10%. */
export function cappedTargetKm(previous: number, proposed: number): number {
  if (!(previous > 0)) return proposed;
  return Math.min(proposed, previous * 1.1);
}
