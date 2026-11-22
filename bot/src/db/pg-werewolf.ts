import type { Pool } from "pg";
import type { WwGame, WwPlayer } from "../services/werewolf";
import type { WerewolfStore, WwOutboxItem, WwStats } from "../services/werewolf-store";

/** PostgreSQL WerewolfStore (migration 0032). */
export class PgWerewolfStore implements WerewolfStore {
  constructor(private readonly pool: Pool) {}

  private rowToGame(r: Record<string, unknown>): WwGame {
    return {
      id: Number(r.id),
      guildId: r.guild_id as string,
      channelId: r.channel_id as string,
      hostId: r.host_id as string,
      status: r.status as WwGame["status"],
      state: r.state as WwGame["state"],
      createdAt: new Date(r.created_at as string).getTime(),
    };
  }

  async createGame(guildId: string, channelId: string, hostId: string, state: WwGame["state"]): Promise<WwGame> {
    const res = await this.pool.query(
      `INSERT INTO werewolf_games (guild_id, channel_id, host_id, status, state)
       VALUES ($1, $2, $3, 'lobby', $4) RETURNING *`,
      [guildId, channelId, hostId, JSON.stringify(state)],
    );
    return this.rowToGame(res.rows[0]);
  }

  async getActiveByChannel(channelId: string): Promise<WwGame | null> {
    const res = await this.pool.query(
      `SELECT * FROM werewolf_games WHERE channel_id = $1 AND status IN ('lobby', 'playing')
       ORDER BY id DESC LIMIT 1`,
      [channelId],
    );
    return res.rows[0] ? this.rowToGame(res.rows[0]) : null;
  }

  async getById(id: number): Promise<WwGame | null> {
    const res = await this.pool.query(`SELECT * FROM werewolf_games WHERE id = $1`, [id]);
    return res.rows[0] ? this.rowToGame(res.rows[0]) : null;
  }

  async getActiveByPlayer(userId: string): Promise<WwGame | null> {
    const res = await this.pool.query(
      `SELECT * FROM werewolf_games
       WHERE status IN ('lobby', 'playing')
         AND state @> $1
       ORDER BY id DESC LIMIT 1`,
      [JSON.stringify({ players: [{ userId }] })],
    );
    // The @> containment above can over-match partial objects in
    // some shapes; verify membership in code to be exact.
    const game = res.rows[0] ? this.rowToGame(res.rows[0]) : null;
    if (game && game.state.players.some((p) => p.userId === userId)) return game;
    if (game) {
      const all = await this.pool.query(
        `SELECT * FROM werewolf_games WHERE status IN ('lobby', 'playing') ORDER BY id DESC LIMIT 50`,
      );
      for (const r of all.rows) {
        const g = this.rowToGame(r);
        if (g.state.players.some((p) => p.userId === userId)) return g;
      }
    }
    return null;
  }

  async save(game: WwGame): Promise<void> {
    await this.pool.query(
      `UPDATE werewolf_games
       SET state = $2, status = $3, host_id = $4,
           finished_at = CASE WHEN $3 IN ('finished', 'cancelled') THEN COALESCE(finished_at, now()) ELSE finished_at END
       WHERE id = $1`,
      [game.id, JSON.stringify(game.state), game.status, game.hostId],
    );
  }

  async listDue(now: number, limit: number): Promise<WwGame[]> {
    const res = await this.pool.query(
      `SELECT * FROM werewolf_games
       WHERE status = 'playing'
         AND (state->>'phaseEndsAt')::float8 > 0
         AND (state->>'phaseEndsAt')::float8 <= $1
       ORDER BY id LIMIT $2`,
      [now, limit],
    );
    return res.rows.map((r) => this.rowToGame(r));
  }

  async lastFinishedByChannel(channelId: string): Promise<WwGame | null> {
    const res = await this.pool.query(
      `SELECT * FROM werewolf_games WHERE channel_id = $1 AND status = 'finished'
       ORDER BY id DESC LIMIT 1`,
      [channelId],
    );
    return res.rows[0] ? this.rowToGame(res.rows[0]) : null;
  }

  async claimStats(gameId: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE werewolf_games SET stats_recorded = TRUE
       WHERE id = $1 AND NOT stats_recorded RETURNING id`,
      [gameId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async recordResult(guildId: string, winner: "wolves" | "village", players: WwPlayer[]): Promise<void> {
    for (const p of players) {
      const side = p.role === "wolf" ? "wolves" : "village";
      const won = side === winner;
      await this.pool.query(
        `INSERT INTO werewolf_stats
           (guild_id, user_id, games, wins, wolf_games, wolf_wins, village_games, village_wins, updated_at)
         VALUES ($1, $2, 1, $3, $4, $5, $6, $7, now())
         ON CONFLICT (guild_id, user_id) DO UPDATE SET
           games = werewolf_stats.games + 1,
           wins = werewolf_stats.wins + EXCLUDED.wins,
           wolf_games = werewolf_stats.wolf_games + EXCLUDED.wolf_games,
           wolf_wins = werewolf_stats.wolf_wins + EXCLUDED.wolf_wins,
           village_games = werewolf_stats.village_games + EXCLUDED.village_games,
           village_wins = werewolf_stats.village_wins + EXCLUDED.village_wins,
           updated_at = now()`,
        [
          guildId, p.userId, won ? 1 : 0,
          side === "wolves" ? 1 : 0, side === "wolves" && won ? 1 : 0,
          side === "village" ? 1 : 0, side === "village" && won ? 1 : 0,
        ],
      );
    }
  }

  private rowToStats(r: Record<string, unknown>): WwStats {
    return {
      userId: r.user_id as string,
      games: Number(r.games), wins: Number(r.wins),
      wolfGames: Number(r.wolf_games), wolfWins: Number(r.wolf_wins),
      villageGames: Number(r.village_games), villageWins: Number(r.village_wins),
    };
  }

  async getStats(guildId: string, userId: string): Promise<WwStats | null> {
    const res = await this.pool.query(
      `SELECT * FROM werewolf_stats WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId],
    );
    return res.rows[0] ? this.rowToStats(res.rows[0]) : null;
  }

  async getStatsAllGuilds(userId: string): Promise<WwStats | null> {
    const res = await this.pool.query(
      `SELECT $1::text AS user_id,
              SUM(games)::int AS games, SUM(wins)::int AS wins,
              SUM(wolf_games)::int AS wolf_games, SUM(wolf_wins)::int AS wolf_wins,
              SUM(village_games)::int AS village_games, SUM(village_wins)::int AS village_wins
       FROM werewolf_stats WHERE user_id = $1 GROUP BY user_id`,
      [userId],
    );
    return res.rows[0] ? this.rowToStats(res.rows[0]) : null;
  }

  async leaderboard(guildId: string, limit: number): Promise<WwStats[]> {
    const res = await this.pool.query(
      `SELECT * FROM werewolf_stats WHERE guild_id = $1
       ORDER BY wins DESC, games DESC LIMIT $2`,
      [guildId, limit],
    );
    return res.rows.map((r) => this.rowToStats(r));
  }

  async enqueue(items: { kind: "channel" | "dm"; targetId: string; text: string; art?: string }[]): Promise<void> {
    for (const it of items) {
      await this.pool.query(
        `INSERT INTO werewolf_outbox (kind, target_id, text, art) VALUES ($1, $2, $3, $4)`,
        [it.kind, it.targetId, it.text, it.art ?? null],
      );
    }
  }

  async drainOutbox(limit: number): Promise<WwOutboxItem[]> {
    const res = await this.pool.query(
      `UPDATE werewolf_outbox SET claimed_at = now()
       WHERE id IN (
         SELECT id FROM werewolf_outbox
         WHERE claimed_at IS NULL OR claimed_at < now() - interval '60 seconds'
         ORDER BY id LIMIT $1
       )
       RETURNING id, kind, target_id, text, art`,
      [limit],
    );
    return res.rows.map((r) => ({
      id: Number(r.id), kind: r.kind as "channel" | "dm",
      targetId: r.target_id as string, text: r.text as string,
      art: (r.art as string | null) ?? null,
    }));
  }

  async ackOutbox(id: number): Promise<void> {
    await this.pool.query(`DELETE FROM werewolf_outbox WHERE id = $1`, [id]);
  }
}
