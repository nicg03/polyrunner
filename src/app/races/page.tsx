import Link from "next/link";
import { RacesBrowser } from "@/components/races-browser";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRaces } from "@/lib/queries";

export const metadata = { title: "Races · PolyRunner" };

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bib?: string }>;
}) {
  const { q = "", bib } = await searchParams;
  const profile = await getCurrentProfile();
  const races = await getRaces();

  const bibRows = profile
    ? await query<{ race_id: string; status: "paid" | "refunded" }>(
        "select race_id, status from bib_entries where user_id = $1",
        [profile.id],
      ).catch(() => [])
    : [];

  const bibByRace = Object.fromEntries(bibRows.map((b) => [b.race_id, b.status]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Races</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search races by name, city, or distance. Filter those with a bib fee to chase a personal
          best — Premium runners get an automatic refund.{" "}
          <Link href="/premium" className="text-primary hover:underline">
            Premium explained →
          </Link>
        </p>
      </div>

      <RacesBrowser
        races={races}
        bibByRace={bibByRace}
        isLoggedIn={Boolean(profile)}
        isPremium={Boolean(profile?.is_premium)}
        initialQuery={q}
        initialBibOnly={bib === "1" || bib === "true"}
      />
    </div>
  );
}
