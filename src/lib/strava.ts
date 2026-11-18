import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";

const SUBSCRIPTIONS = `${API}/push_subscriptions`;

interface StravaConfig {
  clientId: string;
  clientSecret: string;
  source: "env" | "admin";
}

/** Credentials from env vars if set, otherwise the ones saved from the admin page. */
export async function getStravaConfig(): Promise<StravaConfig | null> {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
  if (STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET) {
    return { clientId: STRAVA_CLIENT_ID, clientSecret: STRAVA_CLIENT_SECRET, source: "env" };
  }
  const rows = await query<{ key: string; value: string }>(
    "select key, value from app_settings where key in ('strava_client_id', 'strava_client_secret')",
  );
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  const clientId = get("strava_client_id");
  const clientSecret = get("strava_client_secret");
  return clientId && clientSecret ? { clientId, clientSecret, source: "admin" } : null;
}

async function requireConfig() {
  const config = await getStravaConfig();
  if (!config) throw new Error("Strava is not set up yet");
  return config;
}

export async function isStravaConfigured() {
  return (await getStravaConfig()) !== null;
}

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
  athlete?: { id: number; firstname?: string; lastname?: string; profile_medium?: string };
}

interface AccountRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/** Shared secret for the webhook handshake, derived so it needs no extra setting. */
function verifyTokenFor(clientSecret: string) {
  return createHash("sha256").update(`${clientSecret}:webhook`).digest("hex").slice(0, 32);
}

export async function webhookVerifyToken() {
  const config = await getStravaConfig();
  return config ? verifyTokenFor(config.clientSecret) : null;
}

export function appOrigin(headers: Headers) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function authorizeUrl(redirectUri: string, state: string) {
  const { clientId } = await requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${params}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = await requireConfig();
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status})`);
  return res.json();
}

export type StravaToken = TokenResponse & { athlete: NonNullable<TokenResponse["athlete"]> };

export async function exchangeCode(code: string): Promise<StravaToken> {
  const token = await tokenRequest({ grant_type: "authorization_code", code });
  if (!token.athlete) throw new Error("Strava did not return an athlete");
  return token as StravaToken;
}

function athleteName(token: StravaToken) {
  return [token.athlete.firstname, token.athlete.lastname].filter(Boolean).join(" ");
}

export async function findUserByStravaId(stravaAthleteId: number) {
  const row = await queryOne<{ user_id: string }>(
    "select user_id from strava_accounts where strava_athlete_id = $1",
    [stravaAthleteId],
  );
  return row?.user_id ?? null;
}

/** Signs up a new user from their Strava profile; they log in with Strava, not a password. */
export async function createUserFromStrava(token: StravaToken) {
  const base =
    athleteName(token)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "runner";
  const padded = base.length < 2 ? `${base}_runner` : base;

  for (let attempt = 0; attempt < 20; attempt++) {
    const username = attempt === 0 ? padded : `${padded}${attempt + 1}`;
    const user = await queryOne<{ id: string }>(
      `insert into users (username, password_hash, is_admin)
       select $1, 'strava', not exists (select 1 from users)
        where not exists (select 1 from users where lower(username) = lower($1))
       returning id`,
      [username],
    );
    if (user) return user.id;
  }
  throw new Error("Could not pick a username, try again");
}

export async function saveAccount(userId: string, token: StravaToken, scope: string) {
  const name = athleteName(token);

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

  // Connecting Strava puts you in the Friends section. Strava's placeholder avatars are relative paths.
  const avatar = token.athlete.profile_medium?.startsWith("http") ? token.athlete.profile_medium : null;
  await query(
    `insert into athletes (name, user_id, avatar_url, category)
     select coalesce($2, u.username), u.id, $3, 'friend' from users u
      where u.id = $1 and not exists (select 1 from athletes a where a.user_id = $1)`,
    [userId, name || null, avatar],
  );
}

export interface StravaSetupStatus {
  source: StravaConfig["source"] | null;
  clientId: string | null;
  webhook: "active" | "missing" | "unknown";
}

export async function getStravaSetupStatus(): Promise<StravaSetupStatus> {
  const config = await getStravaConfig();
  if (!config) return { source: null, clientId: null, webhook: "missing" };
  try {
    const subs = await listSubscriptions(config.clientId, config.clientSecret);
    return { source: config.source, clientId: config.clientId, webhook: subs.length > 0 ? "active" : "missing" };
  } catch {
    return { source: config.source, clientId: config.clientId, webhook: "unknown" };
  }
}

async function listSubscriptions(clientId: string, clientSecret: string): Promise<{ id: number }[]> {
  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  const res = await fetch(`${SUBSCRIPTIONS}?${params}`, { cache: "no-store" });
  if (res.status === 401 || res.status === 400 || res.status === 403) {
    throw new Error("Strava rejected these credentials. Check the Client ID and Client Secret.");
  }
  if (!res.ok) throw new Error(`Strava error ${res.status}`);
  return res.json();
}

/** Validates and stores credentials pasted in the admin page, then registers the webhook. */
export async function saveStravaCredentials(clientId: string, clientSecret: string, origin: string) {
  await listSubscriptions(clientId, clientSecret);
  await query(
    `insert into app_settings (key, value) values ('strava_client_id', $1), ('strava_client_secret', $2)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [clientId, clientSecret],
  );
  return ensureWebhook(origin);
}

export async function ensureWebhook(origin: string) {
  const { clientId, clientSecret } = await requireConfig();
  if ((await listSubscriptions(clientId, clientSecret)).length > 0) return true;
  // Strava calls our webhook GET handler during this request to check the verify token.
  const res = await fetch(SUBSCRIPTIONS, {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: `${origin}/api/strava/webhook`,
      verify_token: verifyTokenFor(clientSecret),
    }),
    cache: "no-store",
  });
  return res.ok;
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
