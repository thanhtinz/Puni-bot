/**
 * Moderation CASE system — spec 6.7. Every moderation action creates a
 * case with a per-guild sequential number (#1, #2, ... independent per
 * guild). Cases are editable after the fact (reason/duration) and can be
 * deactivated (e.g. when a mute is lifted early).
 *
 * Numbering must be atomic per guild: the PG store locks the guild's
 * counter row inside the insert transaction; the in-memory store uses
 * the same promise-chain mutex pattern as the economy store.
 */

export type CaseAction = "warn" | "mute" | "kick" | "ban" | "unmute" | "unban" | "note";

export interface ModCase {
  guildId: string;
  caseNo: number;
  targetId: string;
  moderatorId: string;
  action: CaseAction;
  reason: string;
  durationSec: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCaseInput {
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: CaseAction;
  reason?: string;
  durationSec?: number | null;
}

export interface ModCaseStore {
  create(input: CreateCaseInput): Promise<ModCase>;
  get(guildId: string, caseNo: number): Promise<ModCase | null>;
  listForTarget(guildId: string, targetId: string, limit?: number): Promise<ModCase[]>;
  /** Edit reason and/or duration. Returns the updated case or null. */
  update(
    guildId: string,
    caseNo: number,
    patch: { reason?: string; durationSec?: number | null },
  ): Promise<ModCase | null>;
  setActive(guildId: string, caseNo: number, active: boolean): Promise<ModCase | null>;
  countForTarget(guildId: string, targetId: string, action?: CaseAction): Promise<number>;
}

export type CaseHook = (created: ModCase) => void | Promise<void>;

/** Store decorator that notifies hooks after each case creation (used to
 *  feed the moderation log group). Hook failures are logged, never fatal:
 *  a broken log hook must not block a moderation action. */
export class HookedModCaseStore implements ModCaseStore {
  constructor(
    private inner: ModCaseStore,
    private hooks: CaseHook[],
  ) {}

  async create(input: CreateCaseInput): Promise<ModCase> {
    const created = await this.inner.create(input);
    for (const hook of this.hooks) {
      try {
        await hook(created);
      } catch (err) {
        console.error("[puni] case hook failed", err);
      }
    }
    return created;
  }
  get(guildId: string, caseNo: number) {
    return this.inner.get(guildId, caseNo);
  }
  listForTarget(guildId: string, targetId: string, limit?: number) {
    return this.inner.listForTarget(guildId, targetId, limit);
  }
  update(guildId: string, caseNo: number, patch: { reason?: string; durationSec?: number | null }) {
    return this.inner.update(guildId, caseNo, patch);
  }
  setActive(guildId: string, caseNo: number, active: boolean) {
    return this.inner.setActive(guildId, caseNo, active);
  }
  countForTarget(guildId: string, targetId: string, action?: CaseAction) {
    return this.inner.countForTarget(guildId, targetId, action);
  }
}

export class InMemoryModCaseStore implements ModCaseStore {
  private cases = new Map<string, ModCase>(); // key: guildId:caseNo
  private counters = new Map<string, number>();
  private chain: Promise<void> = Promise.resolve();

  private runExclusive<T>(fn: () => T): Promise<T> {
    let result!: T;
    const run = this.chain.then(() => {
      result = fn();
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(() => result);
  }

  async create(input: CreateCaseInput): Promise<ModCase> {
    return this.runExclusive(() => {
      const caseNo = (this.counters.get(input.guildId) ?? 0) + 1;
      this.counters.set(input.guildId, caseNo);
      const now = new Date();
      const modCase: ModCase = {
        guildId: input.guildId,
        caseNo,
        targetId: input.targetId,
        moderatorId: input.moderatorId,
        action: input.action,
        reason: input.reason ?? "",
        durationSec: input.durationSec ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      this.cases.set(`${input.guildId}:${caseNo}`, modCase);
      return { ...modCase };
    });
  }

  async get(guildId: string, caseNo: number): Promise<ModCase | null> {
    const found = this.cases.get(`${guildId}:${caseNo}`);
    return found ? { ...found } : null;
  }

  async listForTarget(guildId: string, targetId: string, limit = 10): Promise<ModCase[]> {
    return [...this.cases.values()]
      .filter((c) => c.guildId === guildId && c.targetId === targetId)
      .sort((a, b) => b.caseNo - a.caseNo)
      .slice(0, limit)
      .map((c) => ({ ...c }));
  }

  async update(
    guildId: string,
    caseNo: number,
    patch: { reason?: string; durationSec?: number | null },
  ): Promise<ModCase | null> {
    const found = this.cases.get(`${guildId}:${caseNo}`);
    if (!found) return null;
    if (patch.reason !== undefined) found.reason = patch.reason;
    if (patch.durationSec !== undefined) found.durationSec = patch.durationSec;
    found.updatedAt = new Date();
    return { ...found };
  }

  async setActive(guildId: string, caseNo: number, active: boolean): Promise<ModCase | null> {
    const found = this.cases.get(`${guildId}:${caseNo}`);
    if (!found) return null;
    found.active = active;
    found.updatedAt = new Date();
    return { ...found };
  }

  async countForTarget(guildId: string, targetId: string, action?: CaseAction): Promise<number> {
    return [...this.cases.values()].filter(
      (c) =>
        c.guildId === guildId &&
        c.targetId === targetId &&
        (action === undefined || c.action === action),
    ).length;
  }
}
