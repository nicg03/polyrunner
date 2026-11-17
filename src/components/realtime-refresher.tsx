"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface RealtimeSubscription {
  table: "markets" | "outcomes" | "trades";
  filter?: string;
}

// Ricarica i dati del Server Component quando cambia qualcosa nelle tabelle osservate.
export function RealtimeRefresher({
  channel,
  subscriptions,
}: {
  channel: string;
  subscriptions: RealtimeSubscription[];
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = JSON.stringify(subscriptions);

  useEffect(() => {
    const supabase = createClient();
    const subs: RealtimeSubscription[] = JSON.parse(key);
    let ch = supabase.channel(channel);

    for (const sub of subs) {
      ch = ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: sub.table, filter: sub.filter },
        () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 400);
        },
      );
    }
    ch.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [channel, key, router]);

  return null;
}
