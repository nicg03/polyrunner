/** Canonical pair ordering so each friendship is a single row. */
export function friendshipPair(a: string, b: string) {
  return a < b ? { user_low: a, user_high: b } : { user_low: b, user_high: a };
}
