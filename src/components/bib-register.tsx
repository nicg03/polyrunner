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
        Bib refunded ({formatEur(priceEur)}) to your PolyRunner EUR wallet.
      </p>
    );
  }
  if (status === "paid") {
    return (
      <p className="text-sm text-muted-foreground">
        Bib registered ({formatEur(priceEur)}). Premium personal best → automatic refund to your EUR
        wallet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">
        Bib fee {formatEur(priceEur)} (simulated). Premium runners get an automatic refund on a
        personal best.
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
          {pending ? "Registering..." : "Confirm bib"}
        </Button>
      ) : (
        <Link href="/login" className={buttonVariants({ size: "sm", variant: "outline" })}>
          Log in to register
        </Link>
      )}
    </div>
  );
}
