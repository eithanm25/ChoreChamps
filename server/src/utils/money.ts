/**
 * Money (and ChoreCoin balances) are stored as decimal strings; convert to
 * integer cents for arithmetic so calculations never accumulate
 * floating-point drift. Shared by taskReview.ts and rewardStore.ts.
 */
export function toCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
