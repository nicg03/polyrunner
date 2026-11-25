export type RaceStatus = "upcoming" | "closed" | "resolved";
export type MarketStatus = "open" | "closed" | "resolved";
export type MarketKind = "time" | "custom" | "goal" | "weekly_freq" | "weekly_km";
/** What's at stake: same wallet either way; beer is the social label among friends. */
export type MarketStake = "credits" | "beer";
export type MarketPricing = "lmsr" | "exact_time";
export type MarketApprovalStatus = "auto" | "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  balance: number;
  lifetime_credits: number;
  eur_balance: number;
  is_premium: boolean;
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
  bib_price_eur: number;
  status: RaceStatus;
  organizer_sponsor?: string | null;
  pb_refund_budget_eur?: number | null;
  affiliate_url?: string | null;
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
  pricing: MarketPricing;
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
  hidden_by_athlete?: boolean;
  requires_approval?: boolean;
  approval_status?: MarketApprovalStatus;
  goal_seconds?: number | null;
  club_id?: string | null;
  week_start?: string | null;
  meta?: Record<string, unknown>;
}

export interface Referral {
  invitee_id: string;
  inviter_id: string;
  credited_at: string | null;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface CommitmentPot {
  id: string;
  user_id: string;
  week_start: string;
  target_km: number;
  amount_eur: number;
  charity_name: string;
  status: "active" | "succeeded" | "failed" | "suspended" | "voided";
  jolly_used: boolean;
  payment_ref: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface TimePrediction {
  id: string;
  market_id: string;
  user_id: string;
  predicted_seconds: number;
  stake: number;
  payout: number | null;
  created_at: string;
  username?: string;
  avatar_url?: string | null;
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
