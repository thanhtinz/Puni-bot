/**
 * Werewolf / Ma sói engine (spec 6.16.4) — a pure state machine.
 *
 * The engine knows nothing about Discord or the database: callers
 * load a WwGame, apply an action, save it back, and deliver the
 * returned announcements (channel posts + DMs) from the outbox the
 * engine appends to. Every phase carries an absolute deadline; the
 * shard tick calls advanceIfDue() so a quiet table never hangs —
 * a role that does not act simply loses its turn.
 *
 * Werewolf is a fame game only: no economy hooks exist here at all
 * (owner law 2026-11-21 — no rewards, no wagers, stats only).
 */

export type WwRoleId =
  | "wolf" | "seer" | "witch" | "hunter" | "guard" | "elder" | "villager";

export interface WwRoleInfo {
  id: WwRoleId;
  name: string;
  side: "wolves" | "village";
  description: string;
}

/** The role library (spec 6.16.4): the default set plus Già làng. */
export const WW_ROLES: Record<WwRoleId, WwRoleInfo> = {
  wolf: {
    id: "wolf", name: "Ma sói", side: "wolves",
    description: "Mỗi đêm, cùng bầy chọn một nạn nhân để giết. Thắng khi số sói bằng hoặc hơn số dân còn sống.",
  },
  seer: {
    id: "seer", name: "Tiên tri", side: "village",
    description: "Mỗi đêm soi một người để biết họ thuộc phe sói hay phe dân.",
  },
  witch: {
    id: "witch", name: "Phù thuỷ", side: "village",
    description: "Có 1 bình cứu (cứu nạn nhân của sói đêm nay) và 1 bình độc (đầu độc một người) cho cả ván.",
  },
  hunter: {
    id: "hunter", name: "Thợ săn", side: "village",
    description: "Khi chết (bị giết hay bị treo cổ), được bắn một phát cuối kéo theo một người.",
  },
  guard: {
    id: "guard", name: "Bảo vệ", side: "village",
    description: "Mỗi đêm chọn một người để bảo vệ khỏi sói; không bảo vệ cùng một người hai đêm liên tiếp.",
  },
  elder: {
    id: "elder", name: "Già làng", side: "village",
    description: "Sống sót qua lần tấn công đầu tiên của bầy sói.",
  },
  villager: {
    id: "villager", name: "Dân làng", side: "village",
    description: "Không có năng lực đặc biệt — suy luận ban ngày và bỏ phiếu treo cổ sói.",
  },
};

export interface WwConfig {
  minPlayers: number;
  maxPlayers: number;
  /** Wolves by player count; missing counts fall back to floor(n/4). */
  wolfTable: Record<number, number>;
  /** Special village roles dealt in, in this order, when enabled. */
  useSeer: boolean;
  useWitch: boolean;
  useGuard: boolean;
  useHunter: boolean;
  useElder: boolean;
  nightMs: number;
  witchMs: number;
  discussMs: number;
  voteMs: number;
  hunterMs: number;
  /** Announce the role of each dead player at dawn / after a lynch. */
  revealRoles: boolean;
}

export const DEFAULT_WW_CONFIG: WwConfig = {
  minPlayers: 5,
  maxPlayers: 20,
  wolfTable: {
    5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 3,
    13: 4, 14: 4, 15: 4, 16: 4, 17: 5, 18: 5, 19: 5, 20: 5,
  },
  useSeer: true,
  useWitch: true,
  useGuard: true,
  useHunter: true,
  useElder: false,
  nightMs: 90_000,
  witchMs: 45_000,
  discussMs: 120_000,
  voteMs: 60_000,
  hunterMs: 45_000,
  revealRoles: true,
};

export function wolfCount(playerCount: number, cfg: WwConfig): number {
  const fromTable = cfg.wolfTable[playerCount];
  const n = fromTable ?? Math.max(1, Math.floor(playerCount / 4));
  return Math.max(1, Math.min(n, Math.floor((playerCount - 1) / 2)));
}

/** Deterministic role list for a player count (before shuffling). */
export function buildRoleSet(playerCount: number, cfg: WwConfig): WwRoleId[] {
  const roles: WwRoleId[] = [];
  const wolves = wolfCount(playerCount, cfg);
  for (let i = 0; i < wolves; i++) roles.push("wolf");
  if (cfg.useSeer) roles.push("seer");
  if (cfg.useWitch && playerCount >= 7) roles.push("witch");
  if (cfg.useGuard && playerCount >= 6) roles.push("guard");
  if (cfg.useHunter && playerCount >= 8) roles.push("hunter");
  if (cfg.useElder) roles.push("elder");
  while (roles.length < playerCount) roles.push("villager");
  return roles.slice(0, playerCount);
}

export interface WwPlayer {
  userId: string;
  name: string;
  /** Stable 1-based seat number used to target actions (masoi giet 3). */
  num: number;
  role: WwRoleId | null;
  alive: boolean;
  /** Elder's one-time wolf shield, consumed on first wolf attack. */
  elderShield: boolean;
}

export type WwPhase =
  | "lobby" | "night" | "witch" | "day" | "vote" | "hunter" | "ended";

export interface WwAnnouncement {
  kind: "channel" | "dm";
  /** channelId for kind=channel, userId for kind=dm. */
  targetId: string;
  text: string;
  /** Optional artwork filename under assets/werewolf/ to attach. */
  art?: string;
}

/**
 * Role-card artwork (owner-supplied set in assets/werewolf/, named
 * after the source set's roles). Only the seven roles this game
 * deals are mapped; the rest of the set stays in reserve for future
 * roles. The secret role DM carries the card image.
 */
export const WW_ROLE_ART: Record<string, string> = {
  wolf: "werewolf.jpg",
  seer: "seer.jpg",
  witch: "potioneer.jpg",
  hunter: "hunter.jpg",
  guard: "bodyguard.jpg",
  elder: "oracle.jpg",
  villager: "villager.jpg",
};

export interface WwState {
  phase: WwPhase;
  round: number;
  players: WwPlayer[];
  phaseEndsAt: number;
  // Night scratch (phase "night")
  wolfPicks: Record<string, string>;
  guardTarget: string | null;
  guardLastTarget: string | null;
  seerTarget: string | null;
  // Witch stage (phase "witch")
  wolfVictim: string | null;
  witchDecision: "pending" | "save" | "poison" | "skip";
  witchPoisonTarget: string | null;
  witchSaveUsed: boolean;
  witchPoisonUsed: boolean;
  // Day vote (phase "vote")
  votes: Record<string, string>;
  // Hunter shot (phase "hunter") — who is about to shoot, and the
  // phase to resume afterwards.
  hunterId: string | null;
  resumePhase: "dawn" | "afterLynch" | null;
  winner: "wolves" | "village" | null;
  log: string[];
}

export interface WwGame {
  id: number;
  guildId: string;
  channelId: string;
  hostId: string;
  status: "lobby" | "playing" | "finished" | "cancelled";
  state: WwState;
  createdAt: number;
}

export interface WwFx {
  announcements: WwAnnouncement[];
  /** Set when the game just ended — caller records stats once. */
  finished?: { winner: "wolves" | "village"; players: WwPlayer[] };
}

const fx = (): WwFx => ({ announcements: [] });

function freshState(): WwState {
  return {
    phase: "lobby",
    round: 0,
    players: [],
    phaseEndsAt: 0,
    wolfPicks: {},
    guardTarget: null,
    guardLastTarget: null,
    seerTarget: null,
    wolfVictim: null,
    witchDecision: "pending",
    witchPoisonTarget: null,
    witchSaveUsed: false,
    witchPoisonUsed: false,
    votes: {},
    hunterId: null,
    resumePhase: null,
    winner: null,
    log: [],
  };
}

export function createLobbyState(host: { userId: string; name: string }): WwState {
  const s = freshState();
  s.players.push({
    userId: host.userId, name: host.name, num: 1,
    role: null, alive: true, elderShield: false,
  });
  return s;
}

export const mention = (userId: string) => `<@${userId}>`;
export const roleName = (role: WwRoleId | null) =>
  role ? WW_ROLES[role].name : "?";
export const alivePlayers = (s: WwState) => s.players.filter((p) => p.alive);
export const playerById = (s: WwState, userId: string) =>
  s.players.find((p) => p.userId === userId);
export const playerByNum = (s: WwState, num: number) =>
  s.players.find((p) => p.num === num);

/** Resolve an action target: a seat number or a raw user id. */
export function resolveTarget(s: WwState, raw: string): WwPlayer | null {
  const byId = playerById(s, raw);
  if (byId) return byId;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n)) return playerByNum(s, n) ?? null;
  return null;
}

function playerListText(s: WwState, withRoles = false): string {
  return s.players
    .map((p) => {
      const mark = p.alive ? "" : " 💀";
      const role = withRoles && p.role ? ` — ${roleName(p.role)}` : "";
      return `**${p.num}.** ${p.name}${role}${mark}`;
    })
    .join("\n");
}

function logLine(s: WwState, text: string): void {
  s.log.push(text);
}

/* ------------------------------ lobby ------------------------------ */

export function joinLobby(
  game: WwGame, user: { userId: string; name: string }, cfg: WwConfig,
): { ok: boolean; error?: string; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "lobby" || s.phase !== "lobby") {
    return { ok: false, error: "Sảnh này đã bắt đầu hoặc đã đóng.", fx: out };
  }
  if (playerById(s, user.userId)) {
    return { ok: false, error: "Bạn đã ở trong sảnh rồi.", fx: out };
  }
  if (s.players.length >= cfg.maxPlayers) {
    return { ok: false, error: `Sảnh đã đủ ${cfg.maxPlayers} người.`, fx: out };
  }
  s.players.push({
    userId: user.userId, name: user.name, num: s.players.length + 1,
    role: null, alive: true, elderShield: false,
  });
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `🐺 ${mention(user.userId)} đã vào sảnh ma sói (**${s.players.length}/${cfg.maxPlayers}** người).`,
  });
  return { ok: true, fx: out };
}

export function leaveLobby(
  game: WwGame, userId: string,
): { ok: boolean; error?: string; fx: WwFx; empty?: boolean } {
  const out = fx();
  const s = game.state;
  if (game.status !== "lobby" || s.phase !== "lobby") {
    return { ok: false, error: "Ván đã bắt đầu, không rời sảnh được nữa.", fx: out };
  }
  const idx = s.players.findIndex((p) => p.userId === userId);
  if (idx < 0) return { ok: false, error: "Bạn không ở trong sảnh này.", fx: out };
  s.players.splice(idx, 1);
  s.players.forEach((p, i) => { p.num = i + 1; });
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `🐺 ${mention(userId)} đã rời sảnh ma sói (còn **${s.players.length}** người).`,
  });
  return { ok: true, fx: out, empty: s.players.length === 0 };
}

/* ------------------------------ start ------------------------------ */

export function startGame(
  game: WwGame, cfg: WwConfig, rng: () => number, now: number,
): { ok: boolean; error?: string; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "lobby" || s.phase !== "lobby") {
    return { ok: false, error: "Ván này đã bắt đầu rồi.", fx: out };
  }
  if (s.players.length < cfg.minPlayers) {
    return {
      ok: false,
      error: `Cần ít nhất ${cfg.minPlayers} người mới bắt đầu được (đang có ${s.players.length}).`,
      fx: out,
    };
  }
  const roles = buildRoleSet(s.players.length, cfg);
  // Fisher–Yates with the injected rng (seeded in tests).
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  s.players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.elderShield = p.role === "elder";
  });
  game.status = "playing";
  const wolves = s.players.filter((p) => p.role === "wolf");
  for (const p of s.players) {
    const info = WW_ROLES[p.role!];
    let text = `🐺 **Vai của bạn: ${info.name}** — ${info.description}`;
    if (p.role === "wolf" && wolves.length > 1) {
      const pack = wolves.filter((w) => w.userId !== p.userId)
        .map((w) => `${w.name} (#${w.num})`).join(", ");
      text += `\nBầy sói của bạn: ${pack}.`;
    }
    text += `\nDanh sách người chơi:\n${playerListText(s)}`;
    out.announcements.push({ kind: "dm", targetId: p.userId, text, art: WW_ROLE_ART[p.role!] });
  }
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `🐺 **Ván ma sói bắt đầu** với ${s.players.length} người chơi! Vai đã được gửi qua tin nhắn riêng cho từng người.\n${playerListText(s)}`,
  });
  logLine(s, `Ván bắt đầu: ${s.players.length} người — ${s.players.map((p) => `${p.name}=${roleName(p.role)}`).join(", ")}.`);
  beginNight(game, cfg, now, out);
  return { ok: true, fx: out };
}

/* ------------------------------ night ------------------------------ */

function beginNight(game: WwGame, cfg: WwConfig, now: number, out: WwFx): void {
  const s = game.state;
  s.round += 1;
  s.phase = "night";
  s.phaseEndsAt = now + cfg.nightMs;
  s.wolfPicks = {};
  s.guardTarget = null;
  s.seerTarget = null;
  s.wolfVictim = null;
  s.witchDecision = "pending";
  s.witchPoisonTarget = null;
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `🌙 **Đêm ${s.round}** buông xuống… Mọi người nhắm mắt. Các vai ban đêm hãy nhắn riêng cho bot để hành động (hạn ${Math.round(cfg.nightMs / 1000)} giây).`,
  });
  const list = `\nDanh sách người còn sống:\n${alivePlayers(s).map((p) => `**${p.num}.** ${p.name}`).join("\n")}`;
  for (const p of alivePlayers(s)) {
    if (p.role === "wolf") {
      out.announcements.push({
        kind: "dm", targetId: p.userId,
        text: `🐺 Đêm ${s.round}: chọn nạn nhân bằng lệnh \`masoi giet <số>\` (nhắn riêng tại đây).${list}`,
      });
    } else if (p.role === "guard") {
      out.announcements.push({
        kind: "dm", targetId: p.userId,
        text: `🛡️ Đêm ${s.round}: chọn người bảo vệ bằng lệnh \`masoi baove <số>\`.${s.guardLastTarget ? `\nĐêm trước bạn đã bảo vệ #${playerById(s, s.guardLastTarget)?.num} — không bảo vệ lại cùng người hai đêm liền.` : ""}${list}`,
      });
    } else if (p.role === "seer") {
      out.announcements.push({
        kind: "dm", targetId: p.userId,
        text: `🔮 Đêm ${s.round}: soi một người bằng lệnh \`masoi soi <số>\`.${list}`,
      });
    }
  }
}

function nightActorsDone(s: WwState): boolean {
  const alive = alivePlayers(s);
  const wolves = alive.filter((p) => p.role === "wolf");
  const wolvesDone = wolves.every((w) => s.wolfPicks[w.userId]);
  const guardDone = !alive.some((p) => p.role === "guard") || s.guardTarget !== null;
  const seerDone = !alive.some((p) => p.role === "seer") || s.seerTarget !== null;
  return wolvesDone && guardDone && seerDone;
}

/** Decide the wolves' victim: majority of picks, ties → lowest seat. */
function wolfVictim(s: WwState): string | null {
  const picks = Object.values(s.wolfPicks);
  if (!picks.length) return null;
  const tally = new Map<string, number>();
  for (const t of picks) tally.set(t, (tally.get(t) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = -1;
  let bestNum = Infinity;
  for (const [target, count] of tally) {
    const num = playerById(s, target)?.num ?? Infinity;
    if (count > bestCount || (count === bestCount && num < bestNum)) {
      best = target; bestCount = count; bestNum = num;
    }
  }
  return best;
}

export function nightAction(
  game: WwGame,
  userId: string,
  action: "kill" | "protect" | "peek",
  targetRaw: string,
  cfg: WwConfig,
  now: number,
): { ok: boolean; error?: string; reply?: string; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "playing" || s.phase !== "night") {
    return { ok: false, error: "Bây giờ không phải lúc hành động ban đêm.", fx: out };
  }
  const me = playerById(s, userId);
  if (!me || !me.alive) return { ok: false, error: "Bạn không ở trong ván này (hoặc đã chết).", fx: out };
  const target = resolveTarget(s, targetRaw);
  if (!target || !target.alive) {
    return { ok: false, error: "Không tìm thấy người chơi đó trong số người còn sống.", fx: out };
  }
  if (action === "kill") {
    if (me.role !== "wolf") return { ok: false, error: "Chỉ Ma sói mới chọn nạn nhân được.", fx: out };
    if (target.userId === userId) return { ok: false, error: "Sói không tự giết mình được.", fx: out };
    s.wolfPicks[userId] = target.userId;
    maybeAdvanceNight(game, cfg, now, out);
    return { ok: true, reply: `Đã ghi chọn nạn nhân: **${target.name}** (#${target.num}).`, fx: out };
  }
  if (action === "protect") {
    if (me.role !== "guard") return { ok: false, error: "Chỉ Bảo vệ mới bảo vệ được.", fx: out };
    if (s.guardLastTarget === target.userId) {
      return { ok: false, error: "Không bảo vệ cùng một người hai đêm liên tiếp.", fx: out };
    }
    s.guardTarget = target.userId;
    maybeAdvanceNight(game, cfg, now, out);
    return { ok: true, reply: `Đêm nay bạn bảo vệ **${target.name}** (#${target.num}).`, fx: out };
  }
  // peek
  if (me.role !== "seer") return { ok: false, error: "Chỉ Tiên tri mới soi được.", fx: out };
  if (target.userId === userId) return { ok: false, error: "Không cần soi chính mình.", fx: out };
  s.seerTarget = target.userId;
  const isWolf = target.role === "wolf";
  maybeAdvanceNight(game, cfg, now, out);
  return {
    ok: true,
    reply: `🔮 **${target.name}** (#${target.num}) thuộc **${isWolf ? "phe SÓI 🐺" : "phe DÂN"}**.`,
    fx: out,
  };
}

function maybeAdvanceNight(game: WwGame, cfg: WwConfig, now: number, out: WwFx): void {
  const s = game.state;
  if (s.phase === "night" && nightActorsDone(s)) {
    enterWitchStage(game, cfg, now, out);
  }
}

function enterWitchStage(game: WwGame, cfg: WwConfig, now: number, out: WwFx): void {
  const s = game.state;
  s.wolfVictim = wolfVictim(s);
  const witch = alivePlayers(s).find((p) => p.role === "witch");
  if (!witch) {
    resolveDawn(game, cfg, now, out);
    return;
  }
  s.phase = "witch";
  s.phaseEndsAt = now + cfg.witchMs;
  s.witchDecision = "pending";
  s.witchPoisonTarget = null;
  const victim = s.wolfVictim ? playerById(s, s.wolfVictim) : null;
  const parts: string[] = [`🧪 Đêm ${s.round} — lượt của Phù thuỷ.`];
  parts.push(victim
    ? `Nạn nhân của sói đêm nay: **${victim.name}** (#${victim.num}).`
    : "Đêm nay sói không chọn nạn nhân nào.");
  if (!s.witchSaveUsed && victim) {
    parts.push("Cứu nạn nhân: `masoi cuu`");
  }
  if (!s.witchPoisonUsed) {
    parts.push("Đầu độc một người: `masoi doc <số>`");
  }
  parts.push("Bỏ qua: `masoi boqua`");
  out.announcements.push({ kind: "dm", targetId: witch.userId, text: parts.join("\n") });
}

export function witchAction(
  game: WwGame,
  userId: string,
  action: "save" | "poison" | "skip",
  targetRaw: string | null,
  cfg: WwConfig,
  now: number,
): { ok: boolean; error?: string; reply?: string; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "playing" || s.phase !== "witch") {
    return { ok: false, error: "Bây giờ không phải lượt của Phù thuỷ.", fx: out };
  }
  const me = playerById(s, userId);
  if (!me || !me.alive || me.role !== "witch") {
    return { ok: false, error: "Chỉ Phù thuỷ mới dùng được lệnh này.", fx: out };
  }
  if (action === "save") {
    if (s.witchSaveUsed) return { ok: false, error: "Bạn đã dùng bình cứu rồi.", fx: out };
    if (!s.wolfVictim) return { ok: false, error: "Đêm nay không có nạn nhân nào để cứu.", fx: out };
    s.witchDecision = "save";
    resolveDawn(game, cfg, now, out);
    return { ok: true, reply: "Bạn đã dùng bình cứu cho nạn nhân đêm nay.", fx: out };
  }
  if (action === "poison") {
    if (s.witchPoisonUsed) return { ok: false, error: "Bạn đã dùng bình độc rồi.", fx: out };
    const target = targetRaw ? resolveTarget(s, targetRaw) : null;
    if (!target || !target.alive) {
      return { ok: false, error: "Không tìm thấy người chơi đó trong số người còn sống.", fx: out };
    }
    if (target.userId === userId) return { ok: false, error: "Không tự đầu độc mình được.", fx: out };
    s.witchDecision = "poison";
    s.witchPoisonTarget = target.userId;
    resolveDawn(game, cfg, now, out);
    return { ok: true, reply: `Bạn đã đầu độc **${target.name}** (#${target.num}).`, fx: out };
  }
  s.witchDecision = "skip";
  resolveDawn(game, cfg, now, out);
  return { ok: true, reply: "Bạn bỏ qua lượt đêm nay.", fx: out };
}

/* ------------------------------ dawn ------------------------------ */

interface Death { player: WwPlayer; cause: "wolf" | "poison" | "lynch" | "hunter" }

function resolveDawn(game: WwGame, cfg: WwConfig, now: number, out: WwFx): void {
  const s = game.state;
  if (s.witchDecision === "poison") s.witchPoisonUsed = true;
  if (s.witchDecision === "save") s.witchSaveUsed = true;
  const deaths: Death[] = [];
  const victim = s.wolfVictim ? playerById(s, s.wolfVictim) : null;
  if (victim && victim.alive) {
    const guarded = s.guardTarget === victim.userId;
    const saved = s.witchDecision === "save";
    if (!guarded && !saved) {
      if (victim.elderShield) {
        victim.elderShield = false;
        logLine(s, `Đêm ${s.round}: sói tấn công ${victim.name} (Già làng) — sống sót nhờ khiên già làng.`);
        out.announcements.push({
          kind: "channel", targetId: game.channelId,
          text: `🌅 Đêm ${s.round}: sói đã tấn công **${victim.name}** nhưng Già làng sống sót qua lần tấn công đầu tiên!`,
        });
      } else {
        victim.alive = false;
        deaths.push({ player: victim, cause: "wolf" });
      }
    } else {
      logLine(s, `Đêm ${s.round}: sói chọn ${victim.name} — ${guarded ? "được Bảo vệ che chở" : "được Phù thuỷ cứu"}.`);
    }
  }
  if (s.witchDecision === "poison" && s.witchPoisonTarget) {
    const target = playerById(s, s.witchPoisonTarget);
    if (target && target.alive) {
      target.alive = false;
      deaths.push({ player: target, cause: "poison" });
    }
  }
  s.guardLastTarget = s.guardTarget;
  for (const d of deaths) {
    logLine(s, `Đêm ${s.round}: ${d.player.name} chết (${d.cause === "wolf" ? "bị sói giết" : "bị đầu độc"}), vai ${roleName(d.player.role)}.`);
  }
  const hunterDeath = deaths.find((d) => d.player.role === "hunter");
  if (!deaths.length && !hunterDeath) {
    out.announcements.push({
      kind: "channel", targetId: game.channelId,
      text: `🌅 **Sáng ngày ${s.round}** — đêm qua bình yên, không ai chết. Cả làng thảo luận trong ${Math.round(cfg.discussMs / 1000)} giây rồi bỏ phiếu bằng \`masoi treo <số>\`.`,
    });
  } else if (!hunterDeath) {
    const names = deaths.map((d) =>
      `**${d.player.name}**${cfg.revealRoles ? ` (${roleName(d.player.role)})` : ""}`).join(", ");
    out.announcements.push({
      kind: "channel", targetId: game.channelId,
      text: `🌅 **Sáng ngày ${s.round}** — đêm qua đã mất: ${names}. Cả làng thảo luận trong ${Math.round(cfg.discussMs / 1000)} giây rồi bỏ phiếu bằng \`masoi treo <số>\`.`,
    });
  }
  if (hunterDeath) {
    enterHunterPhase(game, cfg, now, out, hunterDeath.player, "dawn", deaths);
    return;
  }
  if (finishIfWon(game, cfg, out)) return;
  enterDay(game, cfg, now);
}

function enterDay(game: WwGame, cfg: WwConfig, now: number): void {
  const s = game.state;
  s.phase = "day";
  s.phaseEndsAt = now + cfg.discussMs;
  s.votes = {};
}

/* ------------------------------ vote ------------------------------ */

export function castVote(
  game: WwGame, userId: string, targetRaw: string, cfg: WwConfig, now: number,
): { ok: boolean; error?: string; reply?: string; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "playing" || (s.phase !== "day" && s.phase !== "vote")) {
    return { ok: false, error: "Chưa tới lúc bỏ phiếu.", fx: out };
  }
  const me = playerById(s, userId);
  if (!me || !me.alive) return { ok: false, error: "Người đã chết không bỏ phiếu được.", fx: out };
  const target = resolveTarget(s, targetRaw);
  if (!target || !target.alive) {
    return { ok: false, error: "Không tìm thấy người chơi đó trong số người còn sống.", fx: out };
  }
  if (target.userId === userId) return { ok: false, error: "Không tự treo cổ mình được.", fx: out };
  if (s.phase === "day") {
    s.phase = "vote";
    s.phaseEndsAt = now + cfg.voteMs;
  }
  s.votes[userId] = target.userId;
  const alive = alivePlayers(s);
  const votedCount = Object.keys(s.votes).length;
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `🗳️ ${mention(userId)} đã bỏ phiếu treo **${target.name}** (#${target.num}). (${votedCount}/${alive.length} phiếu)`,
  });
  if (votedCount >= alive.length) resolveVote(game, cfg, now, out);
  return { ok: true, reply: `Đã bỏ phiếu treo **${target.name}**.`, fx: out };
}

function resolveVote(game: WwGame, cfg: WwConfig, now: number, out: WwFx): void {
  const s = game.state;
  const tally = new Map<string, number>();
  for (const t of Object.values(s.votes)) tally.set(t, (tally.get(t) ?? 0) + 1);
  const lines = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => {
      const p = playerById(s, id);
      return p ? `**${p.name}**: ${n} phiếu` : "";
    })
    .filter(Boolean)
    .join(" · ");
  let top: string | null = null;
  let topCount = 0;
  let tied = false;
  for (const [id, n] of tally) {
    if (n > topCount) { top = id; topCount = n; tied = false; }
    else if (n === topCount) { tied = true; }
  }
  if (!top || tied || topCount === 0) {
    logLine(s, `Ngày ${s.round}: bỏ phiếu hoà/không có phiếu — không ai bị treo. ${lines}`);
    out.announcements.push({
      kind: "channel", targetId: game.channelId,
      text: `⚖️ Kết quả bỏ phiếu ngày ${s.round}: ${lines || "không có phiếu nào"} — **không ai bị treo cổ**.`,
    });
    if (finishIfWon(game, cfg, out)) return;
    beginNight(game, cfg, now, out);
    return;
  }
  const lynched = playerById(s, top)!;
  lynched.alive = false;
  logLine(s, `Ngày ${s.round}: ${lynched.name} bị treo cổ (${topCount} phiếu), vai ${roleName(lynched.role)}. Phiếu: ${lines}.`);
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `⚖️ Kết quả bỏ phiếu ngày ${s.round}: ${lines}\n**${lynched.name}** bị treo cổ${cfg.revealRoles ? ` — vai: **${roleName(lynched.role)}**` : ""}.`,
  });
  if (lynched.role === "hunter") {
    enterHunterPhase(game, cfg, now, out, lynched, "afterLynch", []);
    return;
  }
  if (finishIfWon(game, cfg, out)) return;
  beginNight(game, cfg, now, out);
}

/* ------------------------------ hunter ------------------------------ */

function enterHunterPhase(
  game: WwGame, cfg: WwConfig, now: number, out: WwFx,
  hunter: WwPlayer, resume: "dawn" | "afterLynch", deaths: Death[],
): void {
  const s = game.state;
  s.phase = "hunter";
  s.hunterId = hunter.userId;
  s.resumePhase = resume;
  s.phaseEndsAt = now + cfg.hunterMs;
  const deathText = resume === "dawn" && deaths.length
    ? `🌅 **Sáng ngày ${s.round}** — đêm qua đã mất: ${deaths.map((d) => `**${d.player.name}**${cfg.revealRoles ? ` (${roleName(d.player.role)})` : ""}`).join(", ")}.\n`
    : "";
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `${deathText}🏹 **${hunter.name}** là Thợ săn! Trước khi ngã xuống, Thợ săn được bắn một phát cuối trong ${Math.round(cfg.hunterMs / 1000)} giây.`,
  });
  out.announcements.push({
    kind: "dm", targetId: hunter.userId,
    text: `🏹 Bạn là Thợ săn và vừa ngã xuống. Bắn phát cuối bằng lệnh \`masoi ban <số>\` (nhắn riêng tại đây), hoặc bỏ qua bằng \`masoi boqua\`.\nNgười còn sống:\n${alivePlayers(s).map((p) => `**${p.num}.** ${p.name}`).join("\n")}`,
  });
}

export function hunterShot(
  game: WwGame, userId: string, targetRaw: string | null,
  cfg: WwConfig, now: number,
): { ok: boolean; error?: string; reply?: string; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "playing" || s.phase !== "hunter" || s.hunterId !== userId) {
    return { ok: false, error: "Bây giờ không phải lượt bắn của bạn.", fx: out };
  }
  if (targetRaw) {
    const target = resolveTarget(s, targetRaw);
    if (!target || !target.alive) {
      return { ok: false, error: "Không tìm thấy người chơi đó trong số người còn sống.", fx: out };
    }
    target.alive = false;
    logLine(s, `Ngày ${s.round}: Thợ săn ${playerById(s, userId)?.name} bắn phát cuối — ${target.name} chết, vai ${roleName(target.role)}.`);
    out.announcements.push({
      kind: "channel", targetId: game.channelId,
      text: `🏹 Thợ săn bắn phát cuối: **${target.name}** ngã xuống${cfg.revealRoles ? ` — vai: **${roleName(target.role)}**` : ""}.`,
    });
    if (target.role === "hunter" && target.userId !== userId) {
      // A hunter chain: the second hunter also gets a final shot.
      enterHunterPhase(game, cfg, now, out, target, s.resumePhase ?? "dawn", []);
      return { ok: true, reply: `Đã bắn **${target.name}**.`, fx: out };
    }
  } else {
    logLine(s, `Ngày ${s.round}: Thợ săn ${playerById(s, userId)?.name} không bắn phát cuối.`);
  }
  s.hunterId = null;
  const resume = s.resumePhase;
  s.resumePhase = null;
  if (finishIfWon(game, cfg, out)) {
    return { ok: true, reply: targetRaw ? "Đã bắn phát cuối — và ván đã kết thúc!" : "Đã bỏ qua — và ván đã kết thúc!", fx: out };
  }
  if (resume === "dawn") {
    enterDay(game, cfg, now);
    out.announcements.push({
      kind: "channel", targetId: game.channelId,
      text: `☀️ Cả làng thảo luận và bỏ phiếu treo cổ bằng \`masoi treo <số>\`.`,
    });
  } else beginNight(game, cfg, now, out);
  return { ok: true, reply: targetRaw ? "Đã bắn phát cuối." : "Bạn bỏ qua phát bắn cuối.", fx: out };
}

/* ------------------------------ win / end ------------------------------ */

function finishIfWon(game: WwGame, cfg: WwConfig, out: WwFx): boolean {
  const s = game.state;
  const alive = alivePlayers(s);
  const wolves = alive.filter((p) => p.role === "wolf").length;
  const village = alive.length - wolves;
  let winner: "wolves" | "village" | null = null;
  if (wolves === 0) winner = "village";
  else if (wolves >= village) winner = "wolves";
  if (!winner) return false;
  s.winner = winner;
  s.phase = "ended";
  game.status = "finished";
  logLine(s, `Kết thúc: phe ${winner === "wolves" ? "SÓI" : "DÂN"} thắng sau ${s.round} đêm.`);
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: `🏁 **VÁN MA SÓI KẾT THÚC — PHE ${winner === "wolves" ? "SÓI 🐺" : "DÂN 🏡"} THẮNG!**\nVai của mọi người:\n${playerListText(s, true)}`,
  });
  out.finished = { winner, players: s.players.map((p) => ({ ...p })) };
  return true;
}

export function cancelGame(game: WwGame, byName: string): WwFx {
  const out = fx();
  game.status = "cancelled";
  game.state.phase = "ended";
  logLine(game.state, `Ván bị huỷ bởi ${byName}.`);
  out.announcements.push({
    kind: "channel", targetId: game.channelId,
    text: "🐺 Ván ma sói đã bị huỷ.",
  });
  return out;
}

/* ------------------------------ deadlines ------------------------------ */

/**
 * Advance a game whose phase deadline has passed. Called by the
 * shard tick for every due game; also safe to call speculatively.
 * Returns true when a transition happened.
 */
export function advanceIfDue(
  game: WwGame, cfg: WwConfig, now: number,
): { advanced: boolean; fx: WwFx } {
  const out = fx();
  const s = game.state;
  if (game.status !== "playing") return { advanced: false, fx: out };
  if (!s.phaseEndsAt || now < s.phaseEndsAt) return { advanced: false, fx: out };
  switch (s.phase) {
    case "night":
      enterWitchStage(game, cfg, now, out);
      return { advanced: true, fx: out };
    case "witch":
      if (s.witchDecision === "pending") s.witchDecision = "skip";
      resolveDawn(game, cfg, now, out);
      return { advanced: true, fx: out };
    case "day":
      // Discussion over with no votes at all → straight to night.
      if (Object.keys(s.votes).length === 0) {
        logLine(s, `Ngày ${s.round}: hết giờ thảo luận, không ai bỏ phiếu — không ai bị treo.`);
        out.announcements.push({
          kind: "channel", targetId: game.channelId,
          text: `⚖️ Ngày ${s.round}: hết giờ thảo luận mà không có phiếu nào — **không ai bị treo cổ**.`,
        });
        if (!finishIfWon(game, cfg, out)) beginNight(game, cfg, now, out);
      } else {
        resolveVote(game, cfg, now, out);
      }
      return { advanced: true, fx: out };
    case "vote":
      resolveVote(game, cfg, now, out);
      return { advanced: true, fx: out };
    case "hunter": {
      const hunter = s.hunterId ? playerById(s, s.hunterId) : null;
      logLine(s, `Ngày ${s.round}: Thợ săn ${hunter?.name ?? "?"} hết giờ — không bắn phát cuối.`);
      out.announcements.push({
        kind: "channel", targetId: game.channelId,
        text: "🏹 Thợ săn đã hết giờ và không bắn phát cuối.",
      });
      s.hunterId = null;
      const resume = s.resumePhase;
      s.resumePhase = null;
      if (!finishIfWon(game, cfg, out)) {
        if (resume === "dawn") {
          enterDay(game, cfg, now);
          out.announcements.push({
            kind: "channel", targetId: game.channelId,
            text: `☀️ Cả làng thảo luận và bỏ phiếu treo cổ bằng \`masoi treo <số>\`.`,
          });
        } else beginNight(game, cfg, now, out);
      }
      return { advanced: true, fx: out };
    }
    default:
      return { advanced: false, fx: out };
  }
}

/** One-line status for the channel (masoi with no subcommand). */
export function gameStatusText(game: WwGame, cfg: WwConfig): string {
  const s = game.state;
  if (game.status === "lobby") {
    return `🐺 **Sảnh ma sói** đang chờ — **${s.players.length}/${cfg.maxPlayers}** người (cần tối thiểu ${cfg.minPlayers}).\n${playerListText(s)}\nVào sảnh: \`masoi vao\` · Chủ sảnh bắt đầu: \`masoi batdau\``;
  }
  if (game.status === "finished") {
    return `🐺 Ván ma sói đã kết thúc — phe **${s.winner === "wolves" ? "SÓI" : "DÂN"}** thắng.\n${playerListText(s, true)}`;
  }
  if (game.status === "cancelled") return "🐺 Ván ma sói đã bị huỷ.";
  const phaseVi: Record<WwPhase, string> = {
    lobby: "sảnh chờ", night: `đêm ${s.round} — chờ các vai hành động`,
    witch: `đêm ${s.round} — chờ Phù thuỷ`, day: `ngày ${s.round} — đang thảo luận`,
    vote: `ngày ${s.round} — đang bỏ phiếu`, hunter: "Thợ săn bắn phát cuối",
    ended: "đã kết thúc",
  };
  return `🐺 Ván ma sói đang chơi — pha: **${phaseVi[s.phase]}**.\n${playerListText(s)}`;
}
