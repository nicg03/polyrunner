const credits = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCredits(value: number): string {
  return credits.format(Number(value));
}

export function stakeUnit(stake: "credits" | "beer", n = 2): string {
  if (stake === "beer") return n === 1 ? "birra" : "birre";
  return n === 1 ? "credito" : "crediti";
}

export function formatStake(value: number, stake: "credits" | "beer" = "credits"): string {
  const n = Number(value);
  return `${credits.format(n)} ${stakeUnit(stake, Math.abs(n) === 1 ? 1 : 2)}`;
}

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function formatEur(value: number): string {
  return eur.format(Number(value));
}

/** Max payout for an exact-time prediction (stake × multiplier at zero error). */
export function predictionPayout(stake: number, errorSeconds: number, maxError = 600, mult = 2): number {
  if (!(stake > 0) || maxError <= 0) return 0;
  return stake * mult * Math.max(0, 1 - Math.abs(errorSeconds) / maxError);
}

export function formatVolume(value: number): string {
  return compact.format(Number(value));
}

export function formatPercent(price: number): string {
  const pct = price * 100;
  if (pct > 0 && pct < 1) return "<1%";
  if (pct < 100 && pct > 99) return ">99%";
  return `${Math.round(pct)}%`;
}

export function formatCents(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
