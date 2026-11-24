"use client";

import { useEffect, useState } from "react";
import { Beer, Clock, Coins, HelpCircle, User, Users } from "lucide-react";
import { createFriendBet } from "@/actions/markets";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { LocalDateTime } from "@/components/local-date-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import type { Athlete, MarketKind, MarketStake, Race } from "@/lib/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CreateBetForm({
  me,
  friends,
  races,
  initialAthleteId,
  pbs: _pbs,
}: {
  me: Athlete | null;
  friends: Athlete[];
  races: Race[];
  initialAthleteId?: string;
  /** Verified PBs keyed by athlete id (kept for API compat; exact-time markets don't seed brackets). */
  pbs: Record<string, { distance_km: number; time_seconds: number }[]>;
}) {
  const initialIsFriend = friends.some((f) => f.id === initialAthleteId);
  const initialIsMe = me?.id === initialAthleteId;
  const [target, setTarget] = useState<"yourself" | "friend">(
    initialIsFriend ? "friend" : me ? "yourself" : "friend",
  );
  const [athleteId, setAthleteId] = useState(
    initialIsMe ? me!.id : initialIsFriend ? initialAthleteId! : me?.id ?? friends[0]?.id ?? "",
  );
  const [raceId, setRaceId] = useState(races[0]?.id ?? "new");
  const [newDistance, setNewDistance] = useState("21.1");
  const [kind, setKind] = useState<MarketKind>("time");
  const [stake, setStake] = useState<MarketStake>("credits");

  const selected =
    target === "yourself" ? me : friends.find((f) => f.id === athleteId) ?? null;

  useEffect(() => {
    if (target === "yourself" && me) setAthleteId(me.id);
  }, [target, me]);

  return (
    <ActionForm action={createFriendBet} resetOnSuccess={false} className="flex flex-col gap-5">
      {(pending) => (
        <>
          <Field label="Runner">
            <div className="grid grid-cols-2 gap-2">
              <KindButton
                active={target === "yourself"}
                onClick={() => setTarget("yourself")}
                disabled={!me}
              >
                <User className="size-4" /> Yourself
              </KindButton>
              <KindButton
                active={target === "friend"}
                onClick={() => {
                  setTarget("friend");
                  if (!friends.some((f) => f.id === athleteId)) setAthleteId(friends[0]?.id ?? "");
                }}
                disabled={friends.length === 0}
              >
                <Users className="size-4" /> Other friend
              </KindButton>
            </div>
            {!me && (
              <p className="text-xs text-muted-foreground">
                Join as a runner first to create a bet on yourself.
              </p>
            )}
            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add friends (and wait for them to accept) to bet on someone else.
              </p>
            )}
          </Field>

          {target === "friend" && friends.length > 0 && (
            <Field label="Which friend">
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAthleteId(f.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
                      athleteId === f.id
                        ? "border-primary bg-primary/15"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Avatar name={f.name} url={f.avatar_url} size={24} />
                    {f.name}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <input
            type="hidden"
            name="athlete_id"
            value={target === "yourself" ? (me?.id ?? "") : athleteId}
          />

          <Field label="Race">
            <select
              name="race_id"
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className={selectClass}
            >
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {formatDate(r.starts_at)} · {Number(r.distance_km)} km
                </option>
              ))}
              <option value="new">+ New race</option>
            </select>
          </Field>

          {raceId === "new" && (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <Field label="Race name">
                <Input name="new_race_name" required placeholder="Sunday long run 21K" />
              </Field>
              <Field label="Start time">
                <LocalDateTime name="new_race_starts_at" required />
              </Field>
              <Field label="Distance (km)">
                <Input
                  name="new_race_distance_km"
                  required
                  inputMode="decimal"
                  value={newDistance}
                  onChange={(e) => setNewDistance(e.target.value)}
                  placeholder="21.1"
                />
              </Field>
              <Field label="Location (optional)">
                <Input name="new_race_location" placeholder="Milan" />
              </Field>
            </div>
          )}

          <Field label="Bet type">
            <div className="grid grid-cols-2 gap-2">
              <KindButton active={kind === "time"} onClick={() => setKind("time")}>
                <Clock className="size-4" /> Finish time
              </KindButton>
              <KindButton active={kind === "custom"} onClick={() => setKind("custom")}>
                <HelpCircle className="size-4" /> Yes / No
              </KindButton>
            </div>
            <input type="hidden" name="kind" value={kind} />
          </Field>

          <Field label="What's at stake">
            <div className="grid grid-cols-2 gap-2">
              <KindButton active={stake === "credits"} onClick={() => setStake("credits")}>
                <Coins className="size-4" /> Credits
              </KindButton>
              <KindButton active={stake === "beer"} onClick={() => setStake("beer")}>
                <Beer className="size-4" /> Beer
              </KindButton>
            </div>
            <input type="hidden" name="stake" value={stake} />
            <p className="text-xs text-muted-foreground">
              {stake === "beer"
                ? "Same wallet as credits (1 beer = 1 credit), labeled as beers so the loser owes a round among friends."
                : "Classic PolyRunner credits — not transferable or convertible to money."}
            </p>
          </Field>

          {kind === "time" ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Friends stake on an <b className="text-foreground">exact finish time</b>. Payout
              shrinks with the error — no odds or brackets. Credits/beers stay in the virtual
              wallet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Question">
                <Input
                  name="question"
                  required
                  minLength={5}
                  maxLength={140}
                  placeholder={`Will ${selected?.name ?? "Marco"} stop to walk at any point?`}
                />
              </Field>
              <Field label="Initial Yes %">
                <Input name="yes_prob" defaultValue="50" inputMode="decimal" />
              </Field>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Betting closes when the race starts. After the race, {selected?.name ?? "the runner"}{" "}
            submits the finish time with a proof and an admin verifies it.
          </p>

          <Button
            type="submit"
            size="lg"
            disabled={pending || (target === "yourself" ? !me : !athleteId)}
          >
            {pending ? "Creating..." : "Create bet"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

function KindButton({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors disabled:opacity-40",
        active ? "border-primary bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
