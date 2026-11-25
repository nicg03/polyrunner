import Link from "next/link";
import { redirect } from "next/navigation";
import { createClub, joinClub } from "@/actions/clubs";
import { ActionForm } from "@/components/action-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";

export const metadata = { title: "Club · PolyRunner" };

export default async function ClubsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/clubs");

  const clubs = await query<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    members: number;
    is_member: boolean;
  }>(
    `select c.id, c.name, c.slug, c.description,
            (select count(*)::int from club_members cm where cm.club_id = c.id) as members,
            exists(select 1 from club_members cm2 where cm2.club_id = c.id and cm2.user_id = $1) as is_member
       from clubs c
      order by members desc, c.name`,
    [profile.id],
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Club e squadre</h1>
        <p className="text-sm text-muted-foreground">
          Sfide tra gruppi: il membro meno forte conta di più quando corre per la squadra.
        </p>
      </div>

      <ActionForm action={createClub} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        {(pending) => (
          <>
            <h2 className="font-medium">Crea un club</h2>
            <Input name="name" required placeholder="Gruppo del martedì" minLength={3} />
            <Input name="description" placeholder="Descrizione (opzionale)" />
            <Button type="submit" disabled={pending}>
              {pending ? "Creazione..." : "Crea"}
            </Button>
          </>
        )}
      </ActionForm>

      <div className="flex flex-col rounded-xl border bg-card">
        {clubs.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nessun club ancora.</p>
        )}
        {clubs.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 border-b p-4 last:border-b-0"
          >
            <div>
              <Link href={`/clubs/${c.slug}`} className="font-medium hover:underline">
                {c.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {c.members} membri{c.description ? ` · ${c.description}` : ""}
              </p>
            </div>
            {c.is_member ? (
              <Link href={`/clubs/${c.slug}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Apri
              </Link>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await joinClub(c.id);
                }}
              >
                <Button size="sm" type="submit">
                  Entra
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
