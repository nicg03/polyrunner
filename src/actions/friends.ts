"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { friendshipPair } from "@/lib/friendship";
import type { ActionResult } from "@/lib/types";

function revalidateFriends() {
  revalidatePath("/", "layout");
  revalidatePath("/friends");
  revalidatePath("/leaderboard");
}

/** Sends a friend request to the user behind this runner. They must accept. */
export async function requestFriend(athleteId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in to add friends" };

  const athlete = await queryOne<{ name: string; user_id: string }>(
    `select name, user_id from athletes
      where id = $1 and category = 'friend' and user_id is not null and user_id <> $2`,
    [athleteId, profile.id],
  );
  if (!athlete) return { error: "Runner not found" };

  const { user_low, user_high } = friendshipPair(profile.id, athlete.user_id);
  const existing = await queryOne<{ status: string; requested_by: string }>(
    "select status, requested_by from friendships where user_low = $1 and user_high = $2",
    [user_low, user_high],
  );

  if (existing?.status === "accepted") return { ok: `You're already friends with ${athlete.name}` };
  if (existing?.status === "pending" && existing.requested_by === profile.id) {
    return { ok: "Friend request already sent" };
  }
  if (existing?.status === "pending" && existing.requested_by !== profile.id) {
    await query(
      `update friendships set status = 'accepted', responded_at = now()
        where user_low = $1 and user_high = $2`,
      [user_low, user_high],
    );
    revalidateFriends();
    return { ok: `You're now friends with ${athlete.name}` };
  }

  await query(
    `insert into friendships (user_low, user_high, requested_by, status)
     values ($1, $2, $3, 'pending')`,
    [user_low, user_high, profile.id],
  );
  revalidateFriends();
  return { ok: `Friend request sent to ${athlete.name}` };
}

export async function acceptFriend(fromUserId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  const { user_low, user_high } = friendshipPair(profile.id, fromUserId);
  const row = await queryOne<{ requested_by: string }>(
    `select requested_by from friendships
      where user_low = $1 and user_high = $2 and status = 'pending' and requested_by = $3`,
    [user_low, user_high, fromUserId],
  );
  if (!row) return { error: "No pending request from this user" };

  await query(
    `update friendships set status = 'accepted', responded_at = now()
      where user_low = $1 and user_high = $2`,
    [user_low, user_high],
  );
  revalidateFriends();
  return { ok: "Friend request accepted" };
}

export async function declineFriend(fromUserId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  const { user_low, user_high } = friendshipPair(profile.id, fromUserId);
  await query(
    `delete from friendships
      where user_low = $1 and user_high = $2 and status = 'pending' and requested_by = $3`,
    [user_low, user_high, fromUserId],
  );
  revalidateFriends();
  return { ok: "Friend request declined" };
}

export async function cancelFriendRequest(athleteId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  const athlete = await queryOne<{ user_id: string }>(
    "select user_id from athletes where id = $1 and user_id is not null",
    [athleteId],
  );
  if (!athlete) return { error: "Runner not found" };
  const { user_low, user_high } = friendshipPair(profile.id, athlete.user_id);
  await query(
    `delete from friendships
      where user_low = $1 and user_high = $2 and status = 'pending' and requested_by = $3`,
    [user_low, user_high, profile.id],
  );
  revalidateFriends();
  return { ok: "Friend request cancelled" };
}

export async function removeFriend(athleteId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Log in first" };
  const athlete = await queryOne<{ user_id: string }>(
    "select user_id from athletes where id = $1 and user_id is not null",
    [athleteId],
  );
  if (!athlete) return { error: "Runner not found" };
  const { user_low, user_high } = friendshipPair(profile.id, athlete.user_id);
  await query("delete from friendships where user_low = $1 and user_high = $2", [user_low, user_high]);
  revalidateFriends();
  return { ok: "Removed from your friends" };
}
