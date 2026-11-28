"use client";

import { useState, useTransition } from "react";
import { Camera, Link2, Medal } from "lucide-react";
import { toast } from "sonner";
import { submitResult } from "@/actions/results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTime } from "@/lib/time";
import type { ClaimStatus, EvidenceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { id: EvidenceKind; label: string; icon: typeof Link2 }[] = [
  { id: "strava", label: "Link Strava", icon: Link2 },
  { id: "photo", label: "Foto orologio", icon: Camera },
  { id: "official", label: "Risultati ufficiali", icon: Medal },
];

const MAX_SIDE = 2000;

/** Re-encodes big photos as JPEG so phone pictures fit the upload limit; keeps the original if it can't. */
async function shrinkPhoto(file: File): Promise<File> {
  if (file.size < 1.5 * 1024 * 1024 && file.type === "image/jpeg") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "watch.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function SubmitResultForm({
  marketId,
  athleteName,
  myClaim,
}: {
  marketId: string;
  athleteName: string;
  myClaim: { status: ClaimStatus; time_seconds: number } | null;
}) {
  const [kind, setKind] = useState<EvidenceKind>("strava");
  const [pending, startTransition] = useTransition();

  // Submitted by hand rather than through `action`, so a rejected proof doesn't wipe the form.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const photo = formData.get("photo");
      if (photo instanceof File && photo.size > 0) {
        formData.set("photo", await shrinkPhoto(photo));
      }
      const res = await submitResult(null, formData);
      if (res?.error) toast.error(res.error);
      else if (res?.ok) {
        toast.success(res.ok);
        form.reset();
      }
    });
  }

  return (
    <section id="submit-result" className="flex scroll-mt-20 flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-medium">Invia il risultato</h2>
        <p className="text-sm text-muted-foreground">
          Inserisci il tempo di arrivo di {athleteName} e allega una prova. Un admin lo verifica
          prima che il mercato venga liquidato.
        </p>
      </div>

      {myClaim && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            myClaim.status === "rejected" ? "border-no/40 bg-no/10" : "border-primary/40 bg-primary/10",
          )}
        >
          {myClaim.status === "rejected"
            ? `L'ultimo risultato (${formatTime(myClaim.time_seconds)}) non è stato accettato. Puoi inviarne uno nuovo con una prova più chiara.`
            : `Hai inviato ${formatTime(myClaim.time_seconds)}. In attesa di verifica; un nuovo invio sostituisce il precedente.`}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="market_id" value={marketId} />
        <input type="hidden" name="evidence_kind" value={kind} />

        <div className="flex flex-col gap-1.5">
          <Label>Tempo di arrivo (chip time se disponibile)</Label>
          <Input name="time" required placeholder="1:45:30" className="max-w-40" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Prova</Label>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                  kind === k.id
                    ? "border-primary bg-primary/15"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <k.icon className="size-4 shrink-0" /> {k.label}
              </button>
            ))}
          </div>
        </div>

        {kind === "photo" ? (
          <div className="flex flex-col gap-1.5">
            <Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
            <p className="text-xs text-muted-foreground">
              Foto nitida dell&apos;orologio con tempo e distanza, idealmente con pettorale o area
              arrivo visibili.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Input
              key={kind}
              name="evidence_url"
              type="url"
              required
              placeholder={
                kind === "strava" ? "https://www.strava.com/activities/..." : "https://results.example.com/..."
              }
            />
            <p className="text-xs text-muted-foreground">
              {kind === "strava"
                ? "L'attività deve essere visibile a tutti su Strava, altrimenti l'admin non può aprirla."
                : "La pagina dei risultati con nome dell'atleta e tempo."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Nota (opzionale)</Label>
          <Input name="note" maxLength={280} placeholder="Pettorale, riga in classifica, ecc." />
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Invio..." : "Invia risultato"}
        </Button>
      </form>
    </section>
  );
}