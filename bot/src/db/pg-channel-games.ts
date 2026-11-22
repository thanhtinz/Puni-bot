import type { Pool } from "pg";
import type { ChannelGameKind, ChannelGameRow, ChannelGameStore } from "../services/channel-games";

/** PostgreSQL ChannelGameStore (migration 0023). */
export class PgChannelGameStore implements ChannelGameStore {
  constructor(private readonly pool: Pool) {}

  async get(guildId: string, channelId: string): Promise<ChannelGameRow | null> {
    const res = await this.pool.query(
      `SELECT kind, state FROM channel_games WHERE guild_id = $1 AND channel_id = $2`,
      [guildId, channelId],
    );
    const r = res.rows[0];
    return r ? { kind: r.kind as ChannelGameKind, state: r.state as Record<string, unknown> } : null;
  }

  async set(guildId: string, channelId: string, kind: ChannelGameKind, state: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO channel_games (guild_id, channel_id, kind, state, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (guild_id, channel_id) DO UPDATE
         SET kind = EXCLUDED.kind, state = EXCLUDED.state, updated_at = now()`,
      [guildId, channelId, kind, JSON.stringify(state)],
    );
  }

  async delete(guildId: string, channelId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM channel_games WHERE guild_id = $1 AND channel_id = $2`,
      [guildId, channelId],
    );
  }
}
