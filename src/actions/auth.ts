"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

function safeNext(formData: FormData) {
  const next = String(formData.get("next") ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function register(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!/^[a-zA-Z0-9_.-]{2,24}$/.test(username)) {
    return { error: "Username must be 2-24 characters: letters, numbers, _ . -" };
  }
  if (password.length < 6) return { error: "Password must be at least 6 characters" };

  const existing = await queryOne("select 1 from users where lower(username) = lower($1)", [username]);
  if (existing) return { error: "Username already taken" };

  // The first user to sign up becomes admin.
  const user = await queryOne<{ id: string }>(
    `insert into users (username, password_hash, is_admin)
     values ($1, $2, not exists (select 1 from users))
     returning id`,
    [username, await hashPassword(password)],
  );
  await createSession(user!.id);
  redirect(safeNext(formData));
}

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = await queryOne<{ id: string; password_hash: string }>(
    "select id, password_hash from users where lower(username) = lower($1)",
    [username],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Wrong username or password" };
  }
  await createSession(user.id);
  redirect(safeNext(formData));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
