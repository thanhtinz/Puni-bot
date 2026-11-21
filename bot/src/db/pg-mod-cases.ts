/**
 * PostgreSQL moderation case store. Case creation locks the guild's row
 * in mod_case_counters inside the same transaction as the INSERT, so two
 * shards can never hand out the same case number for a guild.
 */
import type { Pool, PoolClient } from "pg";
import type { CaseAction, CreateCaseInput, ModCase, ModCaseStore } from "../services/mod-cases";

interface Row {
  guild_id: string;
  case_no: number;
  target_id: string;
  moderator_id: string;
  action: CaseAction;
  reason: string;
  duration_sec: number | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

function toCase(r: Row): ModCase {
  return {
    guildId: r.guild_id,
    caseNo: r.case_no,
    targetId: r.target_id,
    moderatorId: r.moderator_id,
    action: r.action,
    reason: r.reason,
    durationSec: r.duration_sec,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLUMNS =
  "guild_id, case_no, target_id, moderator_id, action, reason, duration_sec, active, created_at, updated_at";

export class PgModCaseStore implements ModCaseStore {
  constructor(private pool: Pool) {}

  async create(input: CreateCaseInput): Promise<ModCase> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO mod_case_counters (guild_id, next_no) VALUES ($1, 1)
         ON CONFLICT (guild_id) DO NOTHING`,
        [input.guildId],
      );
      const counter = await client.query<{ next_no: number }>(
        "SELECT next_no FROM mod_case_counters WHERE guild_id = $1 FOR UPDATE",
        [input.guildId],
      );
      const caseNo = counter.rows[0].next_no;
      await client.query("UPDATE mod_case_counters SET next_no = $2 WHERE guild_id = $1", [
        input.guildId,
        caseNo + 1,
      ]);
      const res = await client.query<Row>(
        `INSERT INTO mod_cases (guild_id, case_no, target_id, moderator_id, action, reason, duration_sec)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [
          input.guildId,
          caseNo,
          input.targetId,
          input.moderatorId,
          input.action,
          input.reason ?? "",
          input.durationSec ?? null,
        ],
      );
      await client.query("COMMIT");
      return toCase(res.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async get(guildId: string, caseNo: number): Promise<ModCase | null> {
    const res = await this.pool.query<Row>(
      `SELECT ${COLUMNS} FROM mod_cases WHERE guild_id = $1 AND case_no = $2`,
      [guildId, caseNo],
    );
    return res.rows.length ? toCase(res.rows[0]) : null;
  }

  async listForTarget(guildId: string, targetId: string, limit = 10): Promise<ModCase[]> {
    const res = await this.pool.query<Row>(
      `SELECT ${COLUMNS} FROM mod_cases
       WHERE guild_id = $1 AND target_id = $2 ORDER BY case_no DESC LIMIT $3`,
      [guildId, targetId, limit],
    );
    return res.rows.map(toCase);
  }

  async update(
    guildId: string,
    caseNo: number,
    patch: { reason?: string; durationSec?: number | null },
  ): Promise<ModCase | null> {
    const sets: string[] = [];
    const values: unknown[] = [guildId, caseNo];
    if (patch.reason !== undefined) {
      values.push(patch.reason);
      sets.push(`reason = $${values.length}`);
    }
    if (patch.durationSec !== undefined) {
      values.push(patch.durationSec);
      sets.push(`duration_sec = $${values.length}`);
    }
    if (!sets.length) return this.get(guildId, caseNo);
    const res = await this.pool.query<Row>(
      `UPDATE mod_cases SET ${sets.join(", ")}, updated_at = now()
       WHERE guild_id = $1 AND case_no = $2 RETURNING ${COLUMNS}`,
      values,
    );
    return res.rows.length ? toCase(res.rows[0]) : null;
  }

  async setActive(guildId: string, caseNo: number, active: boolean): Promise<ModCase | null> {
    const res = await this.pool.query<Row>(
      `UPDATE mod_cases SET active = $3, updated_at = now()
       WHERE guild_id = $1 AND case_no = $2 RETURNING ${COLUMNS}`,
      [guildId, caseNo, active],
    );
    return res.rows.length ? toCase(res.rows[0]) : null;
  }

  async countForTarget(guildId: string, targetId: string, action?: CaseAction): Promise<number> {
    const res = action
      ? await this.pool.query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM mod_cases WHERE guild_id = $1 AND target_id = $2 AND action = $3",
          [guildId, targetId, action],
        )
      : await this.pool.query<{ n: string }>(
          "SELECT COUNT(*)::text AS n FROM mod_cases WHERE guild_id = $1 AND target_id = $2",
          [guildId, targetId],
        );
    return Number(res.rows[0].n);
  }
}
