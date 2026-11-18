import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

export const isStravaConfigured = Boolean(CLIENT_ID && CLIENT_SECRET);

export const STRAVA_SCOPE = "read,activity:read_all";
export const STATE_COOKIE = "pr_strava_state";

// Activities starting in this window around the gun time count as the race.
const WINDOW_BEFORE_MS = 60 * 60 * 1000;
const WINDOW_AFTER_MS = 8 * 60 * 60 * 1000;
// GPS distance usually reads a bit long; anything outside this ratio is a different run.
const MIN_DISTANCE_RATIO = 0.95;
const MAX_DISTANCE_RATIO = 1.1;
const RUN_TYPES = new Set(["Run", "TrailRun"]);

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  type?: string;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  athlete: { id: number };
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

interface AccountRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/** Shared secret for the webhook handshake, derived so it needs no extra variable. */
export function webhookVerifyToken() {
  return createHash("sha256").update(`${CLIENT_SECRET}:webhook`).digest("hex").slice(0, 32);
}

export function appOrigin(headers: Headers) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export function authorizeUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${params}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      ...params,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status})`);
  return res.json();
}

export async function connectAccount(userId: string, code: string, scope: string) {
  const token = await tokenRequest({ grant_type: "authorization_code", code });
  if (!token.athlete) throw new Error("Strava did not return an athlete");
  const name = [token.athlete.firstname, token.athlete.lastname].filter(Boolean).join(" ");

  // A Strava account can only belong to one PolyRunner user.
  await query("delete from strava_accounts where strava_athlete_id = $1 and user_id <> $2", [
    token.athlete.id,
    userId,
  ]);
  await query(
    `insert into strava_accounts
       (user_id, strava_athlete_id, display_name, access_token, refresh_token, expires_at, scope)
     values ($1, $2, $3, $4, $5, to_timestamp($6), $7)
     on conflict (user_id) do update set
       strava_athlete_id = excluded.strava_athlete_id,
       display_name = excluded.display_name,
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scope = excluded.scope`,
    [userId, token.athlete.id, name || null, token.access_token, token.refresh_token, token.expires_at, scope],
  );
}

async function accessToken(account: AccountRow) {
  if (new Date(account.expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return account.access_token;
  }
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
  });
  await query(
    `update strava_accounts
        set access_token = $2, refresh_token = $3, expires_at = to_timestamp($4)
      where user_id = $1`,
    [account.user_id, token.access_token, token.refresh_token, token.expires_at],
  );
  return token.access_token;
}

async function api<T>(account: AccountRow, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${await accessToken(account)}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strava API error ${res.status} on ${path}`);
  return res.json();
}

function getAccount(where: "user_id" | "strava_athlete_id", value: string | number) {
  return queryOne<AccountRow>(
    `select user_id, access_token, refresh_token, expires_at from strava_accounts where ${where} = $1`,
    [value],
  );
}

export async function disconnectAccount(userId: string) {
  const account = await getAccount("user_id", userId);
  if (!account) return;
  try {
    await fetch(`${OAUTH}/deauthorize`, {
      method: "POST",
      headers: { authorization: `Bearer ${await accessToken(account)}` },
    });
  } finally {
    await query("delete from strava_accounts where user_id = $1", [userId]);
  }
}

export async function deleteAccountByStravaId(stravaAthleteId: number) {
  await query("delete from strava_accounts where strava_athlete_id = $1", [stravaAthleteId]);
}

interface CandidateMarket {
  market_id: string;
  starts_at: string;
  distance_km: number;
}

function matches(activity: StravaActivity, market: CandidateMarket) {
  if (!RUN_TYPES.has(activity.sport_type ?? activity.type ?? "")) return false;
  const start = new Date(activity.start_date).getTime();
  const gun = new Date(market.starts_at).getTime();
  if (start < gun - WINDOW_BEFORE_MS || start > gun + WINDOW_AFTER_MS) return false;
  const ratio = activity.distance / (market.distance_km * 1000);
  return ratio >= MIN_DISTANCE_RATIO && ratio <= MAX_DISTANCE_RATIO;
}

async function proposeResults(userId: string, activities: StravaActivity[]) {
  const markets = await query<CandidateMarket>(
    `select m.id as market_id, r.starts_at, r.distance_km
       from markets m
       join races r on r.id = m.race_id
       join athletes a on a.id = m.athlete_id
      where m.kind = 'time' and m.status <> 'resolved' and a.user_id = $1`,
    [userId],
  );

  let proposed = 0;
  for (const market of markets) {
    for (const activity of activities.filter((a) => matches(a, market))) {
      await query(
        `insert into strava_results
           (market_id, activity_id, activity_name, elapsed_seconds, moving_seconds, distance_m, start_date)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (market_id, activity_id) do update set
           activity_name = excluded.activity_name,
           elapsed_seconds = excluded.elapsed_seconds,
           moving_seconds = excluded.moving_seconds,
           distance_m = excluded.distance_m,
           start_date = excluded.start_date
         where strava_results.status = 'pending'`,
        [
          market.market_id,
          activity.id,
          activity.name,
          activity.elapsed_time,
          activity.moving_time,
          activity.distance,
          activity.start_date,
        ],
      );
      proposed++;
    }
  }
  return proposed;
}

/** Webhook path: a single activity was created or updated on Strava. */
export async function handleActivityEvent(stravaAthleteId: number, activityId: number) {
  const account = await getAccount("strava_athlete_id", stravaAthleteId);
  if (!account) return;
  const activity = await api<StravaActivity>(account, `/activities/${activityId}`);
  await proposeResults(account.user_id, [activity]);
}

export async function handleActivityDeleted(activityId: number) {
  await query("delete from strava_results where activity_id = $1 and status = 'pending'", [activityId]);
}

/** Manual path: look through the linked athlete's activities around the race start. */
export async function syncMarket(marketId: string) {
  const market = await queryOne<{ user_id: string | null; starts_at: string }>(
    `select a.user_id, r.starts_at
       from markets m
       join races r on r.id = m.race_id
       join athletes a on a.id = m.athlete_id
      where m.id = $1 and m.kind = 'time'`,
    [marketId],
  );
  if (!market?.user_id) throw new Error("This athlete is not linked to a PolyRunner user");
  const account = await getAccount("user_id", market.user_id);
  if (!account) throw new Error("The linked user has not connected Strava");

  const gun = new Date(market.starts_at).getTime();
  const after = Math.floor((gun - WINDOW_BEFORE_MS) / 1000);
  const before = Math.floor((gun + WINDOW_AFTER_MS) / 1000);
  const activities = await api<StravaActivity[]>(
    account,
    `/athlete/activities?after=${after}&before=${before}&per_page=30`,
  );
  return proposeResults(market.user_id, activities);
}
