import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, authorizeUrl, isStravaConfigured, STATE_COOKIE } from "@/lib/strava";

// Works both for logged-in users (connect Strava) and visitors (sign up / log in with Strava).
export async function GET(request: NextRequest) {
  const origin = appOrigin(request.headers);
  if (!(await isStravaConfigured())) return NextResponse.redirect(`${origin}/login?strava=unavailable`);

  const nextParam = request.nextUrl.searchParams.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "";

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(await authorizeUrl(`${origin}/api/strava/callback`, state));
  response.cookies.set(STATE_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/strava",
    maxAge: 600,
  });
  return response;
}
