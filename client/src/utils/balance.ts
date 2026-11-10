/**
 * ChildProfile.balance can now go negative — a missed-deadline penalty or a
 * parent fine always deducts the full amount, even past zero (see
 * server/src/services/taskDeadlines.ts and wallet.routes.ts's /parent-adjust).
 * The UI never shows a negative number though: it shows 0 plus a separate
 * "debt" note. There's no separate debt ledger — it's the same balance
 * field, so the debt note just disappears on its own once enough future
 * earnings bring the real (negative) balance back above zero.
 */
export interface BalanceDisplay {
  displayBalance: number;
  debt: number;
}

export function splitBalance(balance: number): BalanceDisplay {
  if (balance >= 0) {
    return { displayBalance: balance, debt: 0 };
  }
  return { displayBalance: 0, debt: -balance };
}
