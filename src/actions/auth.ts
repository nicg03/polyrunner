"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import {
  attachReferral,
  clearReferralCookie,
  readReferralCookie,
  setReferralCookie,
} from "@/lib/referrals";
import { isStravaConfigured } from "@/lib/strava";
import type { ActionResult } from "@/lib/types";

function safeNext(formData: FormData) {
  const next = String(formData.get("next") ?? "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function captureReferral(ref: string) {
  const username = ref.trim();
  if (/^[a-zA-Z0-9_.-]{2,24}$/.test(username)) {
    await setReferralCookie(username);
  }
}

export async function register(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const refParam = String(formData.get("ref") ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Inserisci un'email valida" };
  if (!/^[a-zA-Z0-9_.-]{2,24}$/.test(username)) {
    return { error: "Username: 2-24 caratteri (lettere, numeri, _ . -)" };
  }
  if (password.length < 6) return { error: "La password deve avere almeno 6 caratteri" };

  const existing = await queryOne("select 1 from users where lower(username) = lower($1)", [username]);
  if (existing) return { error: "Username già in uso" };
  if (await queryOne("select 1 from users where lower(email) = $1", [email])) {
    return { error: "Esiste già un account con questa email" };
  }

  if (refParam) await setReferralCookie(refParam);

  const user = await queryOne<{ id: string }>(
    `insert into users (username, email, password_hash, is_admin)
     values ($1, $2, $3, not exists (select 1 from users) or lower($2) = 'niccologatti3@gmail.com')
     returning id`,
    [username, email, await hashPassword(password)],
  );

  const ref = refParam || (await readReferralCookie());
  await attachReferral(user!.id, ref);
  await clearReferralCookie();

  await createSession(user!.id);
  if (await isStravaConfigured()) {
    redirect(`/api/strava/connect?next=${encodeURIComponent(safeNext(formData))}`);
  }
  redirect(safeNext(formData));
}

export async function login(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const identifier = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await queryOne<{ id: string; password_hash: string }>(
    "select id, password_hash from users where lower(email) = $1 or lower(username) = $1 order by (lower(email) = $1) desc limit 1",
    [identifier],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Email o password errati" };
  }
  await createSession(user.id);
  redirect(safeNext(formData));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
