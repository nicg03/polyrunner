import "server-only";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";

export const REF_COOKIE = "pr_ref";

export async function setReferralCookie(username: string) {
  const jar = await cookies();
  jar.set(REF_COOKIE, username.trim().toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readReferralCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REF_COOKIE)?.value ?? null;
}

export async function clearReferralCookie() {
  const jar = await cookies();
  jar.delete(REF_COOKIE);
}

/** Link invitee → inviter after signup. Idempotent. */
export async function attachReferral(inviteeId: string, inviterUsername: string | null) {
  if (!inviterUsername) return;
  const inviter = await queryOne<{ id: string }>(
    "select id from users where lower(username) = lower($1)",
    [inviterUsername],
  );
  if (!inviter || inviter.id === inviteeId) return;
  await query(
    `insert into referrals (invitee_id, inviter_id) values ($1, $2)
     on conflict (invitee_id) do nothing`,
    [inviteeId, inviter.id],
  );
  await clearReferralCookie();
}

/** Award +200 each on first prediction/trade. Safe to call repeatedly. */
export async function maybeAwardReferralBonus(inviteeId: string) {
  try {
    await query("select award_referral_bonus($1)", [inviteeId]);
  } catch {
    // Table may not exist yet on old DBs; ignore.
  }
}
