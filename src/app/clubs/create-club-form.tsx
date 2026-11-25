"use client";

import { createClub } from "@/actions/clubs";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateClubForm() {
  return (
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
  );
}
