import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { JoinRunnerButton } from "@/components/join-runner-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentProfile } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import {
  getFriends,
  getIncomingFriendRequests,
  searchRunners,
  type IncomingRequest,
  type RunnerResult,
} from "@/lib/queries";
import type { Athlete } from "@/lib/types";
import { CopyInviteLink, FriendButton, IncomingRequestButtons } from "./friend-buttons";

export const metadata = { title: "Amici · PolyRunner" };

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getCurrentProfile();
  const { q = "" } = await searchParams;
  const search = q.trim().slice(0, 50);
  if (!profile) {
    const next = search ? `/friends?q=${encodeURIComponent(search)}` : "/friends";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const [friends, results, incoming, me] = await Promise.all([
    getFriends(profile.id),
    searchRunners(search, profile.id),
    getIncomingFriendRequests(profile.id),
    queryOne<{ id: string }>("select id from athletes where user_id = $1", [profile.id]),
  ]);
  const following = friends.filter((f) => f.user_id !== profile.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Amici</h1>
        <p className="text-sm text-muted-foreground">
          Cerca runner e invia una richiesta. Dovete accettarvi a vicenda prima di comparire
          tra gli amici e nelle scommesse.
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">
          {me
            ? "Invia il tuo link: tu e chi si iscrive ricevete +200 crediti al primo pronostico."
            : "Diventa runner così gli amici possono trovarti e scommettere sulle tue gare."}
        </p>
        {me ? <CopyInviteLink username={profile.username} /> : <JoinRunnerButton />}
      </section>

      {incoming.length > 0 && (
        <section className="flex flex-col rounded-xl border border-primary/40 bg-card">
          <h2 className="border-b px-4 py-3 font-medium">
            Richieste di amicizia ({incoming.length})
          </h2>
          {incoming.map((r) => (
            <IncomingRow key={r.user_id} request={r} />
          ))}
        </section>
      )}

      <section className="flex flex-col rounded-xl border bg-card">
        <form className="flex gap-2 border-b p-3" action="/friends">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={search}
              autoFocus={!search}
              placeholder="Cerca per nome o username"
              className="h-9 pl-8"
            />
          </div>
          <button type="submit" className={buttonVariants({ size: "lg" })}>
            Cerca
          </button>
        </form>
        {!search ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Digita un nome o username per trovare runner. Oppure condividi il link qui sopra.
          </p>
        ) : results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nessun runner per &ldquo;{search}&rdquo;. Chiedi di entrare come runner e riprova.
          </p>
        ) : (
          <>
            <p className="px-4 pt-3 text-xs text-muted-foreground">
              {results.length} {results.length === 1 ? "risultato" : "risultati"} per &ldquo;{search}&rdquo;
            </p>
            {results.map((r) => (
              <RunnerRow key={r.id} runner={r} />
            ))}
          </>
        )}
      </section>

      <section className="flex flex-col rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">I tuoi amici ({following.length})</h2>
        {following.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Non hai ancora aggiunto nessuno. Cerca un runner sopra e attendi che accetti.
          </p>
        ) : (
          following.map((f) => <FriendRow key={f.id} friend={f} />)
        )}
      </section>
    </div>
  );
}

function IncomingRow({ request }: { request: IncomingRequest }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      <Avatar name={request.athlete_name ?? request.username} url={request.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{request.athlete_name ?? request.username}</p>
        <p className="truncate text-xs text-muted-foreground">@{request.username}</p>
      </div>
      <IncomingRequestButtons fromUserId={request.user_id} />
    </div>
  );
}

function RunnerRow({ runner }: { runner: RunnerResult }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      <Avatar name={runner.name} url={runner.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{runner.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {runner.username && runner.username !== runner.name ? `@${runner.username} · ` : ""}
          {runner.friends_count} {runner.friends_count === 1 ? "amico" : "amici"}
        </p>
      </div>
      <FriendButton athleteId={runner.id} status={runner.friendship} />
    </div>
  );
}

function FriendRow({ friend }: { friend: Athlete }) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      <Avatar name={friend.name} url={friend.avatar_url} size={36} />
      <p className="min-w-0 flex-1 truncate font-medium">{friend.name}</p>
      <Link href={`/create?athlete=${friend.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Crea scommessa
      </Link>
      <FriendButton athleteId={friend.id} status="friends" />
    </div>
  );
}
