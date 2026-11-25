import { formatTime } from "@/lib/time";
import type { Athlete, Market } from "@/lib/types";

export function marketTitle(
  market: Pick<Market, "kind" | "question" | "goal_seconds">,
  athlete: Pick<Athlete, "name"> | null,
) {
  if ((market.kind === "custom" || market.kind === "goal" || market.kind === "weekly_freq" || market.kind === "weekly_km") && market.question) {
    return market.question;
  }
  if (market.kind === "goal" && market.goal_seconds) {
    return `${athlete?.name ?? "Il runner"} centra sotto ${formatTime(market.goal_seconds)}?`;
  }
  return `Che tempo farà ${athlete?.name ?? "lui/lei"}?`;
}

export function marketIsVisible(market: Pick<Market, "hidden_by_athlete" | "approval_status">) {
  if (market.hidden_by_athlete) return false;
  const status = market.approval_status ?? "auto";
  return status === "auto" || status === "approved";
}
