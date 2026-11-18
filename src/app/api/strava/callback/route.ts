import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { appOrigin, connectAccount, STATE_COOKIE } from "@/lib/strava";

export async function GET(request: NextRequest) {
  const origin = appOrigin(request.headers);
  const params = request.nextUrl.searchParams;
  const done = (status: string) => {
    const response = NextResponse.redirect(`${origin}/portfolio?strava=${status}`);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/strava" });
    return response;
  };

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(`${origin}/login?next=/portfolio`);

  const state = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || state !== params.get("state")) return done("error");
  if (params.get("error")) return done("denied");

  const code = params.get("code");
  const scope = params.get("scope") ?? "";
  if (!code) return done("error");
  if (!scope.includes("activity:read")) return done("scope");

  try {
    await connectAccount(profile.id, code, scope);
  } catch (e) {
    console.error("Strava connect failed", e);
    return done("error");
  }
  return done("connected");
}
