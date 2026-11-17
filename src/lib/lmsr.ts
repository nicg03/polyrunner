// Stesse formule delle funzioni SQL buy_shares / sell_shares, usate per l'anteprima lato client.

export function prices(q: number[], b: number): number[] {
  const max = Math.max(...q);
  const weights = q.map((qi) => Math.exp((qi - max) / b));
  const sum = weights.reduce((a, w) => a + w, 0);
  return weights.map((w) => w / sum);
}

export function cost(q: number[], b: number): number {
  const max = Math.max(...q);
  const sum = q.reduce((a, qi) => a + Math.exp((qi - max) / b), 0);
  return max + b * Math.log(sum);
}

export function sharesForAmount(q: number[], b: number, i: number, amount: number): number {
  const p = prices(q, b)[i];
  return b * Math.log(1 + (Math.exp(amount / b) - 1) / p);
}

export function proceedsForShares(q: number[], b: number, i: number, shares: number): number {
  const p = prices(q, b)[i];
  return Math.max(0, -b * Math.log(1 - p + p * Math.exp(-shares / b)));
}

export function withDelta(q: number[], i: number, delta: number): number[] {
  return q.map((qi, j) => (j === i ? qi + delta : qi));
}

export function outcomePrices<T extends { q_shares: number }>(outcomes: T[], b: number) {
  const p = prices(
    outcomes.map((o) => Number(o.q_shares)),
    Number(b),
  );
  return outcomes.map((o, i) => ({ ...o, price: p[i] }));
}
