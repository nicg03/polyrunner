import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { appOrigin, authorizeUrl, isStravaConfigured, STATE_COOKIE } from "@/lib/strava";

export async function GET(request: NextRequest) {
  const origin = appOrigin(request.headers);
  if (!isStravaConfigured) return NextResponse.redirect(`${origin}/portfolio?strava=unavailable`);

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(`${origin}/login?next=/portfolio`);

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(authorizeUrl(`${origin}/api/strava/callback`, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/strava",
    maxAge: 600,
  });
  return response;
}
