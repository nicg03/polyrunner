import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile, newSessionCookie } from "@/lib/auth";
import {
  appOrigin,
  createUserFromStrava,
  exchangeCode,
  findUserByStravaId,
  saveAccount,
  STATE_COOKIE,
} from "@/lib/strava";

export async function GET(request: NextRequest) {
  const origin = appOrigin(request.headers);
  const params = request.nextUrl.searchParams;
  const [state, next] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split("|");
  const profile = await getCurrentProfile();

  const finish = (path: string, status: string) => {
    const url = new URL(path, origin);
    url.searchParams.set("strava", status);
    const response = NextResponse.redirect(url);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/strava" });
    return response;
  };
  const failPath = profile ? "/profile" : "/login";

  if (!state || state !== params.get("state")) return finish(failPath, "error");
  if (params.get("error")) return finish(failPath, "denied");
  const code = params.get("code");
  const scope = params.get("scope") ?? "";
  if (!code) return finish(failPath, "error");
  if (!scope.includes("activity:read")) return finish(failPath, "scope");

  try {
    const token = await exchangeCode(code);

    if (profile) {
      await saveAccount(profile.id, token, scope);
      return finish(next || "/profile", "connected");
    }

    const existingUserId = await findUserByStravaId(token.athlete.id);
    const userId = existingUserId ?? (await createUserFromStrava(token));
    await saveAccount(userId, token, scope);

    const response = finish(next || "/", existingUserId ? "welcome_back" : "welcome");
    response.cookies.set(await newSessionCookie(userId));
    return response;
  } catch (e) {
    console.error("Strava login failed", e);
    return finish(failPath, "error");
  }
}
