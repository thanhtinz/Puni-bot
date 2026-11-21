/**
 * Board state store — which Discord message each board currently is.
 * Lives in the bot DB (Tín chốt 2026-11-21 15:53), never in Shop.
 * The sync flow reads this before posting: known message -> edit in
 * place; unknown -> post once and record.
 */
import type { Pool } from "pg";

export interface BoardState {
  guildId: string;
  boardKey: string;
  channelId: string;
  messageId: string;
  contentHash: string;
}

export class PgBoardStore {
  constructor(private pool: Pool) {}

  async get(guildId: string, boardKey: string): Promise<BoardState | null> {
    const res = await this.pool.query<{
      guild_id: string;
      board_key: string;
      channel_id: string;
      message_id: string;
      content_hash: string;
    }>(
      `SELECT guild_id, board_key, channel_id, message_id, content_hash
       FROM board_state WHERE guild_id = $1 AND board_key = $2`,
      [guildId, boardKey],
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      guildId: r.guild_id,
      boardKey: r.board_key,
      channelId: r.channel_id,
      messageId: r.message_id,
      contentHash: r.content_hash,
    };
  }

  async put(state: BoardState): Promise<void> {
    await this.pool.query(
      `INSERT INTO board_state (guild_id, board_key, channel_id, message_id, content_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (guild_id, board_key) DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         message_id = EXCLUDED.message_id,
         content_hash = EXCLUDED.content_hash,
         updated_at = now()`,
      [state.guildId, state.boardKey, state.channelId, state.messageId, state.contentHash],
    );
  }

  async forget(guildId: string, boardKey: string): Promise<void> {
    await this.pool.query("DELETE FROM board_state WHERE guild_id = $1 AND board_key = $2", [
      guildId,
      boardKey,
    ]);
  }
}
