import Link from "next/link";
import { LayoutGrid, Plus, Star, UserPlus, Users } from "lucide-react";
import { MarketCard } from "@/components/market-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { JoinRunnerButton } from "@/components/join-runner-button";
import { RaceFilterSelect } from "@/components/race-filter-select";
import { SetupNotice } from "@/components/setup-notice";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getFriends, getMarkets, isUuid } from "@/lib/queries";
import { isDatabaseConfigured } from "@/lib/db";
import type { Athlete } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mercati" };

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ race?: string; status?: string; type?: string; section?: string }>;
}) {
  if (!isDatabaseConfigured) return <SetupNotice />;

  const { race, status = "open", type, section } = await searchParams;
  const selectedRace = race && isUuid(race) ? race : undefined;
  const profile = await getCurrentProfile();
  const [allMarkets, friends] = await Promise.all([
    getMarkets(),
    getFriends(profile?.id ?? null),
  ]);
  const friendIds = new Set(friends.map((f) => f.id));
  const invite = !profile
    ? ("signup" as const)
    : friends.some((f) => f.user_id === profile.id)
      ? null
      : ("join" as const);
  const category = section === "friends" ? "friend" : section === "pros" ? "pro" : null;

  // Opzioni gara: solo gare che hanno mercati (non l’intero catalogo).
  const racesWithMarkets = [
    ...new Map(allMarkets.map((m) => [m.race.id, m.race])).values(),
  ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const markets = allMarkets.filter(
    (m) =>
      (!selectedRace || m.race_id === selectedRace) &&
      (status === "resolved" ? m.status === "resolved" : m.status !== "resolved") &&
      (!type ||
        (type === "beer" ? m.stake === "beer" : m.kind === type)) &&
      (!category || m.athlete?.category === category) &&
      (category !== "friend" || friendIds.has(m.athlete!.id)),
  );

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
      active
        ? "border-primary bg-primary/15 text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const href = (params: { race?: string; status?: string; type?: string; section?: string }) => {
    const sp = new URLSearchParams();
    if (params.section) sp.set("section", params.section);
    if (params.race) sp.set("race", params.race);
    if (params.status && params.status !== "open") sp.set("status", params.status);
    if (params.type) sp.set("type", params.type);
    const s = sp.toString();
    return s ? `/markets?${s}` : "/markets";
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <AutoRefresh intervalMs={15000} />

      <section className="rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Quanto correranno?</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Scommetti crediti virtuali sul tempo esatto dei tuoi amici e su mercati Sì/No.
          I crediti non sono trasferibili né convertibili in denaro.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/races?bib=1" className={buttonVariants({ size: "sm" })}>
            Trova gare con rimborso PB
          </Link>
          {profile && (
            <Link href="/premium" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Premium progress
            </Link>
          )}
        </div>
      </section>

      <nav className="flex gap-1 border-b">
        {SECTIONS.map((s) => (
          <Link
            key={s.label}
            href={href({ section: s.id, race, status, type })}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors",
              section === s.id || (!s.id && !category)
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <s.icon className="size-4" /> {s.label}
          </Link>
        ))}
      </nav>

      {section === "friends" && <FriendsStrip friends={friends} invite={invite} />}

      <div className="flex flex-wrap items-center gap-2">
        <RaceFilterSelect
          races={racesWithMarkets}
          value={selectedRace}
          query={{ section, status, type }}
        />
        <Link href={href({ section, race, status })} className={chip(!type)}>
          All bets
        </Link>
        <Link href={href({ section, race, status, type: "time" })} className={chip(type === "time")}>
          Finish times
        </Link>
        <Link href={href({ section, race, status, type: "custom" })} className={chip(type === "custom")}>
          Yes / No
        </Link>
        <Link href={href({ section, race, status, type: "beer" })} className={chip(type === "beer")}>
          Beer
        </Link>
        <div className="ml-auto flex gap-2">
          <Link href={href({ section, race, type, status: "open" })} className={chip(status !== "resolved")}>
            Active
          </Link>
          <Link
            href={href({ section, race, type, status: "resolved" })}
            className={chip(status === "resolved")}
          >
            Resolved
          </Link>
        </div>
      </div>

      {markets.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {category === "pro"
            ? "No pro markets yet."
            : category === "friend"
              ? profile
                ? "No bets on your friends yet. Add friends or create the first bet!"
                : "No bets on friends yet. Create the first one!"
              : "No markets here yet."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  { id: undefined, label: "All markets", icon: LayoutGrid },
  { id: "friends", label: "Friends", icon: Users },
  { id: "pros", label: "Pros", icon: Star },
];

function FriendsStrip({ friends, invite }: { friends: Athlete[]; invite: "signup" | "join" | null }) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {invite === "signup"
              ? "Log in to see your friends and bet on their races."
              : "No friends yet. Find runners, send a request, and wait until they accept."}
          </p>
        ) : (
          friends.map((f) => (
            <Link
              key={f.id}
              href={`/create?athlete=${f.id}`}
              title={`Create a bet on ${f.name}`}
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Avatar name={f.name} url={f.avatar_url} size={40} />
              <span className="max-w-16 truncate">{f.name}</span>
            </Link>
          ))
        )}
      </div>
      {invite === "signup" && (
        <Link href={`/login?next=${encodeURIComponent("/markets?section=friends")}`} className={buttonVariants()}>
          Sign up to join
        </Link>
      )}
      {invite === "join" && <JoinRunnerButton variant="outline" />}
      {invite !== "signup" && (
        <Link href="/friends" className={buttonVariants({ variant: "outline" })}>
          <UserPlus /> Find friends
        </Link>
      )}
      {invite !== "signup" && friends.length > 0 && (
        <Link href="/create" className={buttonVariants()}>
          <Plus /> Create a bet
        </Link>
      )}
    </section>
  );
}
