/**
 * Gems wallet — the in-game currency (spec 6.17). Gems live in
 * the player's game profile, separate from the global economy (Coins):
 * no conversion between the two in v1. This store is the seam the game
 * module (GĐ9) persists behind PostgreSQL later; the interface stays.
 * Display law: wherever money is shown, Coins and Gems appear TOGETHER.
 */

export interface GemsWallet {
  getBalance(userId: string): Promise<number>;
  /** Add gems (achievement/event rewards). Returns the new balance. */
  credit(userId: string, amount: number): Promise<number>;
  /** Spend gems; false when the balance is insufficient (no change). */
  debit(userId: string, amount: number): Promise<boolean>;
}

export class InMemoryGemsWallet implements GemsWallet {
  private balances = new Map<string, number>();

  async getBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 0;
  }

  async credit(userId: string, amount: number): Promise<number> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid gems amount");
    const next = (this.balances.get(userId) ?? 0) + amount;
    this.balances.set(userId, next);
    return next;
  }

  async debit(userId: string, amount: number): Promise<boolean> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid gems amount");
    const current = this.balances.get(userId) ?? 0;
    if (current < amount) return false;
    this.balances.set(userId, current - amount);
    return true;
  }
}

/** The one-line, two-currency money display used across chat surfaces. */
export function formatMoneyPair(
  coins: number,
  gems: number,
  currencyName: string,
  gemsName = "Gems",
): string {
  return `**${coins.toLocaleString("vi-VN")}** ${currencyName} · **${gems.toLocaleString("vi-VN")}** ${gemsName}`;
}
