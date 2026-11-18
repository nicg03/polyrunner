// Registers the Strava webhook subscription (one per Strava app).
// Usage: STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... APP_URL=https://... node scripts/strava-subscribe.mjs
import { createHash } from "node:crypto";

const { STRAVA_CLIENT_ID: clientId, STRAVA_CLIENT_SECRET: clientSecret, APP_URL: appUrl } = process.env;
if (!clientId || !clientSecret || !appUrl) {
  console.error("Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and APP_URL");
  process.exit(1);
}

const endpoint = "https://www.strava.com/api/v3/push_subscriptions";
const auth = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });

const existing = await (await fetch(`${endpoint}?${auth}`)).json();
if (Array.isArray(existing) && existing.length > 0) {
  console.log("Subscription already exists:", existing);
  process.exit(0);
}

const verifyToken = createHash("sha256").update(`${clientSecret}:webhook`).digest("hex").slice(0, 32);
const res = await fetch(endpoint, {
  method: "POST",
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: `${appUrl.replace(/\/$/, "")}/api/strava/webhook`,
    verify_token: verifyToken,
  }),
});
console.log(res.status, await res.json());
if (!res.ok) process.exit(1);
