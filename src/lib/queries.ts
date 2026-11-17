import { createClient } from "@/lib/supabase/server";
import type { MarketWithRelations, Race } from "@/lib/types";

const MARKET_SELECT = "*, race:races(*), athlete:athletes(*), outcomes(*)";

export async function getMarkets(opts: { raceId?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("markets")
    .select(MARKET_SELECT)
    .order("closes_at", { ascending: true });
  if (opts.raceId) query = query.eq("race_id", opts.raceId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketWithRelations[];
}

export async function getMarket(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("markets").select(MARKET_SELECT).eq("id", id).maybeSingle();
  return data as MarketWithRelations | null;
}

export async function getRaces() {
  const supabase = await createClient();
  const { data } = await supabase.from("races").select("*").order("starts_at");
  return (data ?? []) as Race[];
}
