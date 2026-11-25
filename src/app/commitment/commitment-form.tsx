"use client";

import { createCommitmentPot } from "@/actions/commitment";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CommitmentForm({
  suggested,
  charities,
}: {
  suggested: number;
  charities: readonly string[];
}) {
  return (
    <ActionForm
      action={createCommitmentPot}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      {(pending) => (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Obiettivo km (suggerito {suggested})</Label>
            <Input
              name="target_km"
              defaultValue={String(suggested)}
              inputMode="decimal"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Aumento massimo +10% rispetto all&apos;ultimo pot.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Importo (€)</Label>
            <Input name="amount_eur" defaultValue="10" inputMode="decimal" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>ONLUS</Label>
            <select
              name="charity"
              className="h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
            >
              {charities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Attivazione..." : "Attiva Pot (mock)"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
