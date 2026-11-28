"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type MarketsQuery = {
  section?: string;
  status?: string;
  type?: string;
};

function marketsHref(params: MarketsQuery & { race?: string }) {
  const sp = new URLSearchParams();
  if (params.section) sp.set("section", params.section);
  if (params.race) sp.set("race", params.race);
  if (params.status && params.status !== "open") sp.set("status", params.status);
  if (params.type) sp.set("type", params.type);
  const s = sp.toString();
  return s ? `/markets?${s}` : "/markets";
}

export function RaceFilterSelect({
  races,
  value,
  query,
  className,
}: {
  races: { id: string; name: string }[];
  value?: string;
  query: MarketsQuery;
  className?: string;
}) {
  const router = useRouter();

  if (races.length === 0) return null;

  return (
    <label
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm",
        value
          ? "border-primary bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <CalendarDays className="size-3.5 shrink-0 opacity-70" />
      <select
        aria-label="Filtra per gara"
        value={value ?? ""}
        onChange={(e) =>
          router.push(marketsHref({ ...query, race: e.target.value || undefined }))
        }
        className="max-w-[14rem] cursor-pointer truncate bg-transparent text-sm outline-none sm:max-w-[18rem]"
      >
        <option value="">Tutte le gare</option>
        {races.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}
