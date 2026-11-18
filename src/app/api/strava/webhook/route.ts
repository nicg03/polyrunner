import { after, NextResponse, type NextRequest } from "next/server";
import {
  deleteAccountByStravaId,
  handleActivityDeleted,
  handleActivityEvent,
  isStravaConfigured,
  webhookVerifyToken,
} from "@/lib/strava";

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  updates?: Record<string, string>;
}

// Subscription handshake: Strava echoes back hub.challenge if the verify token matches.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expected = await webhookVerifyToken();
  if (!expected || params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ "hub.challenge": params.get("hub.challenge") });
}

// Strava expects a 200 within 2 seconds, so the work happens after the response.
// Events are not signed: we only use them as a hint and re-read data through the API.
export async function POST(request: NextRequest) {
  const event = (await request.json().catch(() => null)) as StravaEvent | null;
  if (!event || !(await isStravaConfigured())) return NextResponse.json({ ok: true });

  after(async () => {
    try {
      if (event.object_type === "athlete" && event.updates?.authorized === "false") {
        await deleteAccountByStravaId(event.owner_id);
      } else if (event.object_type === "activity" && event.aspect_type === "delete") {
        await handleActivityDeleted(event.object_id);
      } else if (event.object_type === "activity") {
        await handleActivityEvent(event.owner_id, event.object_id);
      }
    } catch (e) {
      console.error("Strava webhook event failed", event, e);
    }
  });

  return NextResponse.json({ ok: true });
}
