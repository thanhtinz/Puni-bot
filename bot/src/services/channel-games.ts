/**
 * Channel games (spec 6.16): counting (đếm số / nối số) and word
 * chain (nối chữ) — one game per channel, state kept in the store.
 *
 * Counting: members count up together — the message must be exactly
 * the next number and the same person may not count twice in a row.
 * A mistake resets the count to zero.
 *
 * Word chain: each message is a phrase of 2+ syllables whose FIRST
 * syllable matches the LAST syllable of the previous phrase
 * (compared tone-insensitively). No repeats, no two turns in a row
 * by the same person. An invalid phrase is rejected, state unchanged.
 */

export type ChannelGameKind = "counting" | "wordchain";

export interface ChannelGameRow {
  kind: ChannelGameKind;
  state: Record<string, unknown>;
}

export interface ChannelGameStore {
  get(guildId: string, channelId: string): Promise<ChannelGameRow | null>;
  set(guildId: string, channelId: string, kind: ChannelGameKind, state: Record<string, unknown>): Promise<void>;
  delete(guildId: string, channelId: string): Promise<void>;
}

export class InMemoryChannelGameStore implements ChannelGameStore {
  private map = new Map<string, ChannelGameRow>();
  async get(guildId: string, channelId: string) {
    const v = this.map.get(`${guildId}:${channelId}`);
    return v ? { kind: v.kind, state: { ...v.state } } : null;
  }
  async set(guildId: string, channelId: string, kind: ChannelGameKind, state: Record<string, unknown>) {
    this.map.set(`${guildId}:${channelId}`, { kind, state: { ...state } });
  }
  async delete(guildId: string, channelId: string) {
    this.map.delete(`${guildId}:${channelId}`);
  }
}

export interface CountingState { current: number; lastUserId: string | null; best: number }
export interface WordchainState { lastWord: string | null; lastUserId: string | null; used: string[]; count: number }

export const freshCounting = (): CountingState => ({ current: 0, lastUserId: null, best: 0 });
export const freshWordchain = (): WordchainState => ({ lastWord: null, lastUserId: null, used: [], count: 0 });

/** Tone-insensitive syllable compare: "tiếng" -> "tieng", "đầu" -> "dau". */
export function normalizeSyllable(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z]/g, "");
}

export type GameMessageOutcome =
  | { action: "ignore" }
  | { action: "ok"; react: "✅" }
  | { action: "wrong"; react: "❌"; reply: string };

export function processCounting(state: CountingState, userId: string, content: string): GameMessageOutcome {
  const trimmed = content.trim();
  if (!/^\d+$/.test(trimmed)) return { action: "ignore" };
  const n = Number.parseInt(trimmed, 10);
  if (state.lastUserId === userId) {
    state.current = 0;
    state.lastUserId = null;
    return {
      action: "wrong", react: "❌",
      reply: `<@${userId}> đếm hai số liên tiếp — đếm lại từ đầu nhé! Số tiếp theo là **1**.`,
    };
  }
  if (n !== state.current + 1) {
    const expected = state.current + 1;
    state.current = 0;
    state.lastUserId = null;
    return {
      action: "wrong", react: "❌",
      reply: `<@${userId}> sai số rồi — phải là **${expected}**. Đếm lại từ đầu: số tiếp theo là **1**.`,
    };
  }
  state.current = n;
  state.lastUserId = userId;
  if (n > state.best) state.best = n;
  return { action: "ok", react: "✅" };
}

export function processWordchain(state: WordchainState, userId: string, content: string): GameMessageOutcome {
  const phrase = content.trim().toLowerCase();
  const syllables = phrase.split(/\s+/).filter(Boolean);
  if (syllables.length < 2) return { action: "ignore" };
  if (state.lastUserId === userId) {
    return {
      action: "wrong", react: "❌",
      reply: `<@${userId}> vừa nối rồi — nhường lượt cho người khác nhé!`,
    };
  }
  if (state.used.includes(phrase)) {
    return {
      action: "wrong", react: "❌",
      reply: `Từ **${phrase}** đã được dùng rồi — chọn từ khác nhé!`,
    };
  }
  if (state.lastWord) {
    const prevSyllables = state.lastWord.split(/\s+/).filter(Boolean);
    const need = normalizeSyllable(prevSyllables[prevSyllables.length - 1]);
    const got = normalizeSyllable(syllables[0]);
    if (need !== got) {
      return {
        action: "wrong", react: "❌",
        reply: `Từ tiếp theo phải bắt đầu bằng **${prevSyllables[prevSyllables.length - 1]}** — thử lại nhé!`,
      };
    }
  }
  state.lastWord = phrase;
  state.lastUserId = userId;
  state.used.push(phrase);
  if (state.used.length > 1000) state.used = state.used.slice(-1000);
  state.count += 1;
  return { action: "ok", react: "✅" };
}

/** Message pipeline used by the Discord client for non-command
 *  messages in game channels. Returns null when the channel has no
 *  game configured. */
export class ChannelGamesService {
  constructor(private readonly store: ChannelGameStore) {}

  async handleMessage(input: {
    guildId: string;
    channelId: string;
    userId: string;
    content: string;
  }): Promise<GameMessageOutcome | null> {
    const row = await this.store.get(input.guildId, input.channelId);
    if (!row) return null;
    if (row.kind === "counting") {
      const state = { ...freshCounting(), ...(row.state as Partial<CountingState>) };
      const outcome = processCounting(state, input.userId, input.content);
      if (outcome.action !== "ignore") {
        await this.store.set(input.guildId, input.channelId, "counting", state as unknown as Record<string, unknown>);
      }
      return outcome;
    }
    const state = { ...freshWordchain(), ...(row.state as Partial<WordchainState>) };
    const outcome = processWordchain(state, input.userId, input.content);
    if (outcome.action !== "ignore") {
      await this.store.set(input.guildId, input.channelId, "wordchain", state as unknown as Record<string, unknown>);
    }
    return outcome;
  }
}
