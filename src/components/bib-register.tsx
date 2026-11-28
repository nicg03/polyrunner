"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { registerBib } from "@/actions/bib";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatEur } from "@/lib/format";

export function BibRegisterButton({
  raceId,
  priceEur,
  status,
  isLoggedIn,
}: {
  raceId: string;
  priceEur: number;
  status: "none" | "paid" | "refunded" | null;
  isLoggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (!(priceEur > 0)) return null;

  if (status === "refunded") {
    return (
      <p className="text-sm text-yes">
        Pettorale rimborsato ({formatEur(priceEur)}) sul wallet EUR di PolyRunner.
      </p>
    );
  }
  if (status === "paid") {
    return (
      <p className="text-sm text-muted-foreground">
        Pettorale registrato ({formatEur(priceEur)}). Con Premium, un personal best → rimborso
        automatico sul wallet EUR.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">
        Quota pettorale {formatEur(priceEur)} (simulata). I runner Premium ricevono un rimborso
        automatico in caso di personal best.
      </p>
      {isLoggedIn ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await registerBib(raceId);
              if (res?.error) toast.error(res.error);
              else if (res?.ok) toast.success(res.ok);
            })
          }
        >
          {pending ? "Registrazione..." : "Conferma pettorale"}
        </Button>
      ) : (
        <Link href="/login" className={buttonVariants({ size: "sm", variant: "outline" })}>
          Accedi per registrarti
        </Link>
      )}
    </div>
  );
}
