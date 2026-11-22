/**
 * Werewolf persistence (spec 6.16.4 + architecture law 2.5): game
 * state lives in the store, never in process memory, so any shard
 * can serve the next action and the phase tick can run anywhere.
 */
import type { WwGame, WwPlayer } from "./werewolf";

export interface WwOutboxItem {
  id: number;
  kind: "channel" | "dm";
  targetId: string;
  text: string;
  /** Artwork filename under assets/werewolf/ to attach, if any. */
  art?: string | null;
}

export interface WwStats {
  userId: string;
  games: number;
  wins: number;
  wolfGames: number;
  wolfWins: number;
  villageGames: number;
  villageWins: number;
}

export interface WerewolfStore {
  createGame(guildId: string, channelId: string, hostId: string, state: WwGame["state"]): Promise<WwGame>;
  /** The lobby/playing game in a channel, if any. */
  getActiveByChannel(channelId: string): Promise<WwGame | null>;
  getById(id: number): Promise<WwGame | null>;
  /** The lobby/playing game a user sits in (routes DM actions). */
  getActiveByPlayer(userId: string): Promise<WwGame | null>;
  save(game: WwGame): Promise<void>;
  /** Playing games whose phase deadline has passed (tick input). */
  listDue(now: number, limit: number): Promise<WwGame[]>;
  /** Most recent finished game in a channel (match record). */
  lastFinishedByChannel(channelId: string): Promise<WwGame | null>;
  /**
   * Atomically claim the right to record stats for a finished game.
   * True exactly once per game — stats are written by the claimer.
   */
  claimStats(gameId: number): Promise<boolean>;
  recordResult(guildId: string, winner: "wolves" | "village", players: WwPlayer[]): Promise<void>;
  getStats(guildId: string, userId: string): Promise<WwStats | null>;
  /** Stats summed across every guild (DM profile view). */
  getStatsAllGuilds(userId: string): Promise<WwStats | null>;
  leaderboard(guildId: string, limit: number): Promise<WwStats[]>;
  /** Queue announcements for the shard tick to deliver. */
  enqueue(items: { kind: "channel" | "dm"; targetId: string; text: string; art?: string }[]): Promise<void>;
  /** Claim up to `limit` queued announcements (60s lease). */
  drainOutbox(limit: number): Promise<WwOutboxItem[]>;
  ackOutbox(id: number): Promise<void>;
}

const emptyStats = (userId: string): WwStats => ({
  userId, games: 0, wins: 0, wolfGames: 0, wolfWins: 0, villageGames: 0, villageWins: 0,
});

export class InMemoryWerewolfStore implements WerewolfStore {
  private games = new Map<number, WwGame>();
  private stats = new Map<string, WwStats>();
  private claimed = new Set<number>();
  private nextId = 1;

  async createGame(guildId: string, channelId: string, hostId: string, state: WwGame["state"]): Promise<WwGame> {
    const game: WwGame = {
      id: this.nextId++, guildId, channelId, hostId,
      status: "lobby", state: structuredClone(state), createdAt: Date.now(),
    };
    this.games.set(game.id, structuredClone(game));
    return structuredClone(game);
  }

  async getActiveByChannel(channelId: string): Promise<WwGame | null> {
    for (const g of this.games.values()) {
      if (g.channelId === channelId && (g.status === "lobby" || g.status === "playing")) {
        return structuredClone(g);
      }
    }
    return null;
  }

  async getById(id: number): Promise<WwGame | null> {
    const g = this.games.get(id);
    return g ? structuredClone(g) : null;
  }

  async getActiveByPlayer(userId: string): Promise<WwGame | null> {
    for (const g of this.games.values()) {
      if ((g.status === "lobby" || g.status === "playing")
        && g.state.players.some((p) => p.userId === userId)) {
        return structuredClone(g);
      }
    }
    return null;
  }

  async save(game: WwGame): Promise<void> {
    this.games.set(game.id, structuredClone(game));
  }

  async listDue(now: number, limit: number): Promise<WwGame[]> {
    const due: WwGame[] = [];
    for (const g of this.games.values()) {
      if (g.status === "playing" && g.state.phaseEndsAt && g.state.phaseEndsAt <= now) {
        due.push(structuredClone(g));
        if (due.length >= limit) break;
      }
    }
    return due;
  }

  async lastFinishedByChannel(channelId: string): Promise<WwGame | null> {
    let best: WwGame | null = null;
    for (const g of this.games.values()) {
      if (g.channelId === channelId && g.status === "finished") {
        if (!best || g.id > best.id) best = g;
      }
    }
    return best ? structuredClone(best) : null;
  }

  async claimStats(gameId: number): Promise<boolean> {
    if (this.claimed.has(gameId)) return false;
    this.claimed.add(gameId);
    return true;
  }

  async recordResult(guildId: string, winner: "wolves" | "village", players: WwPlayer[]): Promise<void> {
    for (const p of players) {
      const key = `${guildId}:${p.userId}`;
      const row = this.stats.get(key) ?? emptyStats(p.userId);
      const side = p.role === "wolf" ? "wolves" : "village";
      row.games += 1;
      if (side === winner) row.wins += 1;
      if (side === "wolves") {
        row.wolfGames += 1;
        if (winner === "wolves") row.wolfWins += 1;
      } else {
        row.villageGames += 1;
        if (winner === "village") row.villageWins += 1;
      }
      this.stats.set(key, row);
    }
  }

  async getStats(guildId: string, userId: string): Promise<WwStats | null> {
    return this.stats.get(`${guildId}:${userId}`) ?? null;
  }

  async getStatsAllGuilds(userId: string): Promise<WwStats | null> {
    let total: WwStats | null = null;
    for (const [key, row] of this.stats) {
      if (!key.endsWith(`:${userId}`)) continue;
      total ??= emptyStats(userId);
      total.games += row.games; total.wins += row.wins;
      total.wolfGames += row.wolfGames; total.wolfWins += row.wolfWins;
      total.villageGames += row.villageGames; total.villageWins += row.villageWins;
    }
    return total;
  }

  private outbox: (WwOutboxItem & { claimedAt: number })[] = [];
  private nextOutboxId = 1;

  async enqueue(items: { kind: "channel" | "dm"; targetId: string; text: string; art?: string }[]): Promise<void> {
    for (const it of items) {
      this.outbox.push({ id: this.nextOutboxId++, claimedAt: 0, ...it });
    }
  }

  async drainOutbox(limit: number): Promise<WwOutboxItem[]> {
    const now = Date.now();
    const out: WwOutboxItem[] = [];
    for (const item of this.outbox) {
      if (out.length >= limit) break;
      if (item.claimedAt && now - item.claimedAt < 60_000) continue;
      item.claimedAt = now;
      out.push({ id: item.id, kind: item.kind, targetId: item.targetId, text: item.text, art: item.art ?? null });
    }
    return out;
  }

  async ackOutbox(id: number): Promise<void> {
    this.outbox = this.outbox.filter((i) => i.id !== id);
  }

  async leaderboard(guildId: string, limit: number): Promise<WwStats[]> {
    return [...this.stats.entries()]
      .filter(([k]) => k.startsWith(`${guildId}:`))
      .map(([, v]) => v)
      .sort((a, b) => b.wins - a.wins || b.games - a.games)
      .slice(0, limit);
  }
}
