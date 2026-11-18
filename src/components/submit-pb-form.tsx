"use client";

import { useState, useTransition } from "react";
import { Camera, Link2, Medal } from "lucide-react";
import { toast } from "sonner";
import { submitPersonalBest } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EvidenceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { id: EvidenceKind; label: string; icon: typeof Link2 }[] = [
  { id: "strava", label: "Strava link", icon: Link2 },
  { id: "photo", label: "Watch photo", icon: Camera },
  { id: "official", label: "Official results", icon: Medal },
];

const MAX_SIDE = 2000;

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

export function SubmitPbForm() {
  const [kind, setKind] = useState<EvidenceKind>("strava");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const photo = formData.get("photo");
      if (photo instanceof File && photo.size > 0) {
        formData.set("photo", await shrinkPhoto(photo));
      }
      const res = await submitPersonalBest(null, formData);
      if (res?.error) toast.error(res.error);
      else if (res?.ok) {
        toast.success(res.ok);
        form.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="evidence_kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Distance (km)</Label>
          <Input name="distance_km" required inputMode="decimal" placeholder="42.195" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Time</Label>
          <Input name="time" required placeholder="3:29:45" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Proof that this is your time</Label>
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
        <Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
      ) : (
        <Input
          key={kind}
          name="evidence_url"
          type="url"
          required
          placeholder={
            kind === "strava" ? "https://www.strava.com/activities/..." : "https://results.example.com/..."
          }
        />
      )}

      <Input name="note" maxLength={280} placeholder="Optional note (race name, bib…)" />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending..." : "Submit personal best"}
      </Button>
    </form>
  );
}
