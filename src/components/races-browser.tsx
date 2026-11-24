"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Ruler, Search } from "lucide-react";
import { BibRegisterButton } from "@/components/bib-register";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Race } from "@/lib/types";

type BibStatus = "none" | "paid" | "refunded";

export function RacesBrowser({
  races,
  bibByRace,
  isLoggedIn,
  isPremium,
  initialQuery = "",
  initialBibOnly = false,
}: {
  races: Race[];
  bibByRace: Record<string, BibStatus>;
  isLoggedIn: boolean;
  isPremium: boolean;
  initialQuery?: string;
  initialBibOnly?: boolean;
}) {
  const [q, setQ] = useState(initialQuery);
  const [bibOnly, setBibOnly] = useState(initialBibOnly);
  const [when, setWhen] = useState<"upcoming" | "past" | "all">("upcoming");

  const filtered = useMemo(() => {
    const now = Date.now();
    const needle = q.trim().toLowerCase();
    return races.filter((r) => {
      const starts = new Date(r.starts_at).getTime();
      if (when === "upcoming" && starts < now) return false;
      if (when === "past" && starts >= now) return false;
      const price = Number(r.bib_price_eur) || 0;
      if (bibOnly && !(price > 0)) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.location ?? "").toLowerCase().includes(needle) ||
        String(r.distance_km).includes(needle)
      );
    });
  }, [races, q, bibOnly, when]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, city, or distance…"
            className="h-11 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["upcoming", "Upcoming"],
              ["past", "Past"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setWhen(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                when === id
                  ? "border-primary bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBibOnly((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              bibOnly
                ? "border-amber-500/50 bg-amber-400/15 text-amber-600"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            With bib (PB refund)
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isPremium
            ? "You are Premium: register a bib, beat your PB on race day, and PolyRunner refunds the fee to your EUR wallet."
            : "Premium runners get an automatic bib refund on a personal best. Unlock Premium from lifetime credits, then chase a PB here."}{" "}
          <Link href="/premium" className="text-primary hover:underline">
            How Premium works →
          </Link>
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No races match. Try clearing filters or ask an admin to add a race with a bib price.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((r) => {
            const price = Number(r.bib_price_eur) || 0;
            const status = bibByRace[r.id] ?? "none";
            const upcoming = new Date(r.starts_at).getTime() > Date.now();
            return (
              <li key={r.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/races/${r.id}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {r.name}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" /> {formatDateTime(r.starts_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Ruler className="size-3.5" /> {Number(r.distance_km)} km
                      </span>
                      {r.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5" /> {r.location}
                        </span>
                      )}
                      {!upcoming && <span className="text-muted-foreground">Past</span>}
                    </div>
                  </div>
                  {price > 0 ? (
                    <span className="rounded-md bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-600">
                      Bib {formatEur(price)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No bib fee</span>
                  )}
                </div>
                {price > 0 && upcoming && (
                  <div className="mt-3 border-t pt-3">
                    <BibRegisterButton
                      raceId={r.id}
                      priceEur={price}
                      status={status}
                      isLoggedIn={isLoggedIn}
                    />
                  </div>
                )}
                {price > 0 && !upcoming && status === "paid" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Bib was registered. If you ran a Premium PB, the refund appears in your EUR
                    wallet after the market is resolved.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
