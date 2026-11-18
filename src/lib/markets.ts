import type { Athlete, Market } from "@/lib/types";

export function marketTitle(market: Pick<Market, "kind" | "question">, athlete: Pick<Athlete, "name"> | null) {
  if (market.kind === "custom" && market.question) return market.question;
  return `What time will ${athlete?.name ?? "they"} run?`;
}
