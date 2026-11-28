import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Fresh-start moments: Monday, 1st of month, New Year. */
export function FreshStartBanner() {
  const now = new Date();
  const day = now.getDay();
  const date = now.getDate();
  const month = now.getMonth();

  let message: string | null = null;
  if (month === 0 && date === 1) message = "Capodanno: riparti con un obiettivo chiaro.";
  else if (date === 1) message = "Primo del mese: riparti. Imposta i km della settimana.";
  else if (day === 1) message = "È lunedì: nuova settimana, nuovi mercati.";

  if (!message) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <p className="text-sm font-medium">{message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link href="/commitment" className={buttonVariants({ size: "sm", variant: "outline" })}>
          Commitment Pot
        </Link>
        <Link href="/create" className={buttonVariants({ size: "sm", variant: "outline" })}>
          Crea un mercato
        </Link>
      </div>
    </div>
  );
}
