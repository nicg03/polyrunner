export type RaceStatus = "upcoming" | "closed" | "resolved";
export type MarketStatus = "open" | "closed" | "resolved";
export type MarketKind = "time" | "custom";
/** What's at stake: same wallet either way; beer is the social label among friends. */
export type MarketStake = "credits" | "beer";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  created_at: string;
}

export interface Race {
  id: string;
  name: string;
  starts_at: string;
  distance_km: number;
  location: string | null;
  image_url: string | null;
  status: RaceStatus;
}

export type AthleteCategory = "friend" | "pro";

export interface Athlete {
  id: string;
  name: string;
  avatar_url: string | null;
  personal_best_seconds: number | null;
  bio: string | null;
  category: AthleteCategory;
  user_id: string | null;
}

export interface Outcome {
  id: string;
  market_id: string;
  label: string;
  min_seconds: number | null;
  max_seconds: number | null;
  q_shares: number;
  sort_order: number;
}

export interface Market {
  id: string;
  race_id: string;
  athlete_id: string | null;
  kind: MarketKind;
  stake: MarketStake;
  question: string | null;
  liquidity_b: number;
  status: MarketStatus;
  closes_at: string | null;
  actual_time_seconds: number | null;
  winning_outcome_id: string | null;
  strava_activity_id: number | null;
  result_claim_id: string | null;
  created_by: string | null;
  volume: number;
  created_at: string;
}

export interface StravaResult {
  id: string;
  market_id: string;
  activity_id: number;
  activity_name: string | null;
  elapsed_seconds: number;
  moving_seconds: number | null;
  distance_m: number;
  start_date: string;
}

export type EvidenceKind = "strava" | "photo" | "official";
export type ClaimStatus = "pending" | "accepted" | "rejected";

/** A submitted finish time with its proof; the photo itself is served by /api/claims/[id]/photo. */
export interface ResultClaim {
  id: string;
  market_id: string;
  username: string;
  time_seconds: number;
  evidence_kind: EvidenceKind;
  evidence_url: string | null;
  note: string | null;
  status: ClaimStatus;
  created_at: string;
}

/** A personal-best claim waiting for (or already through) admin review. */
export interface PbClaim {
  id: string;
  athlete_id: string;
  username: string;
  distance_km: number;
  time_seconds: number;
  evidence_kind: EvidenceKind;
  evidence_url: string | null;
  note: string | null;
  status: ClaimStatus;
  created_at: string;
}

export interface MarketWithRelations extends Market {
  race: Race;
  athlete: Athlete | null;
  outcomes: Outcome[];
}

export interface Position {
  user_id: string;
  outcome_id: string;
  market_id: string;
  shares: number;
  cost_basis: number;
}

export interface Trade {
  id: number;
  user_id: string;
  market_id: string;
  outcome_id: string;
  side: "buy" | "sell";
  shares: number;
  cost: number;
  price_after: number;
  created_at: string;
}

export interface PriceSnapshot {
  outcome_id: string;
  price: number;
  created_at: string;
}

export interface LeaderboardRow {
  id: string;
  username: string;
  avatar_url: string | null;
  balance: number;
  positions_value: number;
  total_value: number;
}

export type ActionResult = { ok?: string; error?: string } | null;
