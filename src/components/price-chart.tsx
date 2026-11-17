"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PriceSnapshot } from "@/lib/types";

export const OUTCOME_COLORS = [
  "#2d6cf5",
  "#27ae60",
  "#f2c94c",
  "#e64800",
  "#bb6bd9",
  "#2bb3c0",
  "#f2994a",
  "#eb5757",
];

interface ChartOutcome {
  id: string;
  label: string;
  price: number;
}

export function PriceChart({
  outcomes,
  snapshots,
}: {
  outcomes: ChartOutcome[];
  snapshots: PriceSnapshot[];
}) {
  const data = useMemo(() => {
    const byTime = new Map<number, Record<string, number>>();
    for (const s of snapshots) {
      const t = new Date(s.created_at).getTime();
      const row = byTime.get(t) ?? { t };
      row[s.outcome_id] = Math.round(s.price * 1000) / 10;
      byTime.set(t, row);
    }
    const now: Record<string, number> = { t: Date.now() };
    for (const o of outcomes) now[o.id] = Math.round(o.price * 1000) / 10;
    return [...byTime.values(), now].sort((a, b) => a.t - b.t);
  }, [snapshots, outcomes]);

  const labelFor = (id: string) => outcomes.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {outcomes.map((o, i) => (
          <span key={o.id} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: OUTCOME_COLORS[i % OUTCOME_COLORS.length] }}
            />
            <span className="text-muted-foreground">{o.label}</span>
            <span className="font-semibold">{Math.round(o.price * 100)}%</span>
          </span>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) =>
                new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
              }
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              orientation="right"
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(t) => new Date(Number(t)).toLocaleString("it-IT")}
              formatter={(value, name) => [`${value}%`, labelFor(String(name))]}
            />
            {outcomes.map((o, i) => (
              <Line
                key={o.id}
                dataKey={o.id}
                type="stepAfter"
                stroke={OUTCOME_COLORS[i % OUTCOME_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
