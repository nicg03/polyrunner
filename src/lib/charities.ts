export const CHARITIES = [
  "Fondazione Veronesi",
  "Emergency",
  "AIRC",
  "Medici Senza Frontiere",
] as const;

export type CharityName = (typeof CHARITIES)[number];

export function listCharities(): readonly string[] {
  return CHARITIES;
}
