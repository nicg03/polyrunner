"use client";

import { useEffect, useState } from "react";
import { Beer, Clock, Coins, HelpCircle, Target, User, Users } from "lucide-react";
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
                <User className="size-4" /> Te stesso
              </KindButton>
              <KindButton
                active={target === "friend"}
                onClick={() => {
                  setTarget("friend");
                  if (!friends.some((f) => f.id === athleteId)) setAthleteId(friends[0]?.id ?? "");
                }}
                disabled={friends.length === 0}
              >
                <Users className="size-4" /> Un amico
              </KindButton>
            </div>
            {!me && (
              <p className="text-xs text-muted-foreground">
                Diventa runner per creare una scommessa su di te.
              </p>
            )}
            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aggiungi amici (e attendi l&apos;accettazione) per scommettere su qualcun altro.
              </p>
            )}
          </Field>

          {target === "friend" && friends.length > 0 && (
            <Field label="Quale amico">
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

          <Field label="Gara">
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
              <option value="new">+ Nuova gara</option>
            </select>
          </Field>

          {raceId === "new" && (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <Field label="Nome gara">
                <Input name="new_race_name" required placeholder="Long run domenica 21K" />
              </Field>
              <Field label="Partenza">
                <LocalDateTime name="new_race_starts_at" required />
              </Field>
              <Field label="Distanza (km)">
                <Input
                  name="new_race_distance_km"
                  required
                  inputMode="decimal"
                  value={newDistance}
                  onChange={(e) => setNewDistance(e.target.value)}
                  placeholder="21.1"
                />
              </Field>
              <Field label="Luogo (opzionale)">
                <Input name="new_race_location" placeholder="Milano" />
              </Field>
            </div>
          )}

          <Field label="Tipo di scommessa">
            <div className="grid grid-cols-3 gap-2">
              <KindButton active={kind === "time"} onClick={() => setKind("time")}>
                <Clock className="size-4" /> Tempo
              </KindButton>
              <KindButton active={kind === "goal"} onClick={() => setKind("goal")}>
                <Target className="size-4" /> Obiettivo
              </KindButton>
              <KindButton active={kind === "custom"} onClick={() => setKind("custom")}>
                <HelpCircle className="size-4" /> Sì / No
              </KindButton>
            </div>
            <input type="hidden" name="kind" value={kind} />
          </Field>

          <Field label="In palio">
            <div className="grid grid-cols-2 gap-2">
              <KindButton active={stake === "credits"} onClick={() => setStake("credits")}>
                <Coins className="size-4" /> Crediti
              </KindButton>
              <KindButton active={stake === "beer"} onClick={() => setStake("beer")}>
                <Beer className="size-4" /> Birra
              </KindButton>
            </div>
            <input type="hidden" name="stake" value={stake} />
            <p className="text-xs text-muted-foreground">
              {stake === "beer"
                ? "Stesso wallet dei crediti (1 birra = 1 credito), etichettato come birre tra amici."
                : "Crediti PolyRunner — non trasferibili né convertibili in denaro."}
            </p>
          </Field>

          {kind === "time" ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Gli amici puntano su un <b className="text-foreground">tempo esatto</b>. Il payout
              diminuisce con l&apos;errore — niente quote o fasce.
            </p>
          ) : kind === "goal" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Obiettivo (es. 1:35:00)">
                <Input name="goal_time" required placeholder="1:35:00" />
              </Field>
              <Field label="% Sì iniziale">
                <Input name="yes_prob" defaultValue="50" inputMode="decimal" />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Domanda">
                <Input
                  name="question"
                  required
                  minLength={5}
                  maxLength={140}
                  placeholder={`${selected?.name ?? "Marco"} camminerà almeno una volta?`}
                />
              </Field>
              <Field label="% Sì iniziale">
                <Input name="yes_prob" defaultValue="50" inputMode="decimal" />
              </Field>
              {target === "friend" && (
                <p className="text-xs text-amber-600 sm:col-span-2">
                  Le domande libere su un amico richiedono la sua approvazione prima di diventare pubbliche.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Le scommesse chiudono all&apos;inizio della gara. Dopo, {selected?.name ?? "il runner"}{" "}
            invia il tempo con una prova e un admin lo verifica.
          </p>

          <Button
            type="submit"
            size="lg"
            disabled={pending || (target === "yourself" ? !me : !athleteId)}
          >
            {pending ? "Creazione..." : "Crea scommessa"}
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
