import Link from "next/link";
import { RacesBrowser } from "@/components/races-browser";
import { getCurrentProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRaces } from "@/lib/queries";

export const metadata = { title: "Gare · PolyRunner" };

const DISTANCES = new Set(["all", "10k", "half", "marathon", "other"]);

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bib?: string; distance?: string }>;
}) {
  const { q = "", bib, distance: distanceParam } = await searchParams;
  const profile = await getCurrentProfile();
  const races = await getRaces();

  const bibRows = profile
    ? await query<{ race_id: string; status: "paid" | "refunded" }>(
        "select race_id, status from bib_entries where user_id = $1",
        [profile.id],
      ).catch(() => [])
    : [];

  const bibByRace = Object.fromEntries(bibRows.map((b) => [b.race_id, b.status]));
  const initialDistance =
    distanceParam && DISTANCES.has(distanceParam)
      ? (distanceParam as "all" | "10k" | "half" | "marathon" | "other")
      : "all";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Gare</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cerca per nome, città o distanza. Filtra le mezze e le maratone, oppure quelle con
          pettorale per inseguire un PB — i runner Premium ricevono il rimborso automatico.{" "}
          <Link href="/premium" className="text-primary hover:underline">
            Premium spiegato →
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
        initialDistance={initialDistance}
      />
    </div>
  );
}
