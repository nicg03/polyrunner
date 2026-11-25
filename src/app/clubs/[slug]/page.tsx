import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClubChallenge, leaveClub } from "@/actions/clubs";
import { ActionForm } from "@/components/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { weekStartUtc } from "@/lib/credits";

export default async function ClubDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=/clubs/${slug}`);

  const club = await queryOne<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
  }>("select * from clubs where slug = $1", [slug]);
  if (!club) notFound();

  const [members, otherClubs, leaderboard] = await Promise.all([
    query<{ username: string; role: string }>(
      `select u.username, cm.role from club_members cm
         join users u on u.id = cm.user_id
        where cm.club_id = $1 order by cm.role = 'owner' desc, u.username`,
      [club.id],
    ),
    query<{ id: string; name: string }>(
      `select id, name from clubs where id <> $1 order by name`,
      [club.id],
    ),
    query<{ username: string; km: number }>(
      `select u.username, coalesce(s.distance_km, 0) as km
         from club_members cm
         join users u on u.id = cm.user_id
         left join weekly_activity_stats s
           on s.user_id = cm.user_id and s.week_start = $2::date
        where cm.club_id = $1
        order by km desc, u.username`,
      [club.id, weekStartUtc()],
    ),
  ]);

  const memberCheck = await queryOne(
    `select 1 from club_members where club_id = $1 and user_id = $2`,
    [club.id, profile.id],
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div>
        <Link href="/clubs" className="text-sm text-muted-foreground hover:underline">
          ← Club
        </Link>
        <h1 className="text-2xl font-semibold">{club.name}</h1>
        {club.description && <p className="text-sm text-muted-foreground">{club.description}</p>}
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-medium">Leaderboard settimana</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {leaderboard.map((r, i) => (
            <li key={r.username} className="flex justify-between">
              <span>
                {i + 1}. {r.username}
              </span>
              <span className="text-muted-foreground">{Number(r.km).toFixed(1)} km</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-medium">Membri ({members.length})</h2>
        <ul className="text-sm">
          {members.map((m) => (
            <li key={m.username}>
              {m.username}{" "}
              <span className="text-xs text-muted-foreground">({m.role})</span>
            </li>
          ))}
        </ul>
        {memberCheck && (
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await leaveClub(club.id);
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              Esci dal club
            </Button>
          </form>
        )}
      </section>

      {memberCheck && otherClubs.length > 0 && (
        <ActionForm
          action={createClubChallenge}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4"
        >
          {(pending) => (
            <>
              <h2 className="font-medium">Sfida km vs km</h2>
              <input type="hidden" name="club_a" value={club.id} />
              <select
                name="club_b"
                className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
              >
                {otherClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={pending}>
                {pending ? "Creazione..." : "Crea mercato di sfida"}
              </Button>
            </>
          )}
        </ActionForm>
      )}

      {!memberCheck && (
        <Link href="/clubs" className={buttonVariants()}>
          Torna ai club per entrare
        </Link>
      )}
    </div>
  );
}
