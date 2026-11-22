/**
 * Minigame session storage (spec 6.16 + architecture law 2.5):
 * blackjack hands, tictactoe boards and coinflip challenges live in
 * a shared store — never in process memory — so any shard can serve
 * the next move.
 */
export interface GameSessionStore {
  get(userId: string, game: string): Promise<Record<string, unknown> | null>;
  set(userId: string, game: string, state: Record<string, unknown>): Promise<void>;
  delete(userId: string, game: string): Promise<void>;
}

export class InMemoryGameSessionStore implements GameSessionStore {
  private map = new Map<string, Record<string, unknown>>();
  async get(userId: string, game: string) {
    const v = this.map.get(`${userId}:${game}`);
    return v ? { ...v } : null;
  }
  async set(userId: string, game: string, state: Record<string, unknown>) {
    this.map.set(`${userId}:${game}`, { ...state });
  }
  async delete(userId: string, game: string) {
    this.map.delete(`${userId}:${game}`);
  }
}
