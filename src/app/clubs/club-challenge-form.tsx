"use client";

import { createClubChallenge } from "@/actions/clubs";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";

export function ClubChallengeForm({
  clubId,
  otherClubs,
}: {
  clubId: string;
  otherClubs: { id: string; name: string }[];
}) {
  return (
    <ActionForm
      action={createClubChallenge}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      {(pending) => (
        <>
          <h2 className="font-medium">Sfida km vs km</h2>
          <input type="hidden" name="club_a" value={clubId} />
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
  );
}
