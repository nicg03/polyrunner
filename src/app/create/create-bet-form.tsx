"use client";

import { useMemo, useState } from "react";
import { Clock, HelpCircle } from "lucide-react";
import { createFriendBet } from "@/actions/markets";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { LocalDateTime } from "@/components/local-date-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { bucketsFromThresholds, parseTime } from "@/lib/time";
import type { Athlete, MarketKind, Race } from "@/lib/types";
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
  friends,
  races,
  initialAthleteId,
}: {
  friends: Athlete[];
  races: Race[];
  initialAthleteId?: string;
}) {
  const [athleteId, setAthleteId] = useState(
    friends.some((f) => f.id === initialAthleteId) ? initialAthleteId! : "",
  );
  const [raceId, setRaceId] = useState(races[0]?.id ?? "new");
  const [kind, setKind] = useState<MarketKind>("time");
  const [thresholds, setThresholds] = useState("3:30:00, 3:45:00, 4:00:00");

  const friend = friends.find((f) => f.id === athleteId);
  const buckets = useMemo(() => {
    const secs = thresholds.split(",").map((s) => parseTime(s.trim()));
    return secs.some((s) => s === null) ? [] : bucketsFromThresholds(secs as number[]);
  }, [thresholds]);

  return (
    <ActionForm action={createFriendBet} resetOnSuccess={false} className="flex flex-col gap-5">
      {(pending) => (
        <>
          <Field label="Friend">
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
            <input type="hidden" name="athlete_id" value={athleteId} />
          </Field>

          <Field label="Race">
            <select
              name="race_id"
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className={selectClass}
            >
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {formatDate(r.starts_at)}
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
                <Input name="new_race_distance_km" required inputMode="decimal" placeholder="21.1" />
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

          {kind === "time" ? (
            <Field label="Time thresholds, comma separated (mm:ss or h:mm:ss)">
              <Input name="thresholds" value={thresholds} onChange={(e) => setThresholds(e.target.value)} />
              {buckets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {buckets.map((b) => (
                    <span key={b.label} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-no">Use times like 45:00 or 1:45:00</p>
              )}
            </Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Question">
                <Input
                  name="question"
                  required
                  minLength={5}
                  maxLength={140}
                  placeholder={`Will ${friend?.name ?? "Marco"} stop to walk at any point?`}
                />
              </Field>
              <Field label="Initial Yes %">
                <Input name="yes_prob" defaultValue="50" inputMode="decimal" />
              </Field>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Trading closes when the race starts. The result comes from{" "}
            {`${friend?.name ?? "your friend"}'s`} Strava activity and is confirmed by an admin.
          </p>

          <Button type="submit" size="lg" disabled={pending || !athleteId}>
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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
