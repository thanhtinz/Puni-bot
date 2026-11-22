/**
 * Minigame commands (spec 6.16) — all wager the shared economy:
 *   coinflip (cf)  — vs the bot, or challenge another player
 *   blackjack (bj) — session game: bj <cược> then bj hit / bj stand
 *   tictactoe (ttt)— vs the bot (easy/medium/hard) or challenge
 *   race (dua)     — bet on one of 5 animals at fixed odds
 * Session state lives in the GameSessionStore (PostgreSQL in
 * production), never in process memory.
 */
import type { CommandDef } from "@puni/shared";
import type { GameSessionStore } from "../services/game-sessions";
import {
  ANIMALS,
  bjHit,
  bjStand,
  bjStart,
  formatBoard,
  formatHand,
  formatRace,
  handValue,
  simulateRace,
  tttBotMove,
  tttWinner,
  type BjState,
  type TttCell,
  type TttDifficulty,
} from "../services/minigames";

export interface GamesEconomyHooks {
  debit(userId: string, amount: number, source: string, note?: string): Promise<boolean>;
  credit(userId: string, amount: number, source: string, note?: string): Promise<void>;
}

const fmt = (n: number) => n.toLocaleString("vi-VN");
const MIN_BET = 10;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function parseBet(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= MIN_BET ? n : null;
}

export function createGameCommands(deps: {
  economy: GamesEconomyHooks;
  sessions: GameSessionStore;
  currencyName: () => string;
  rng?: () => number;
  now?: () => Date;
}): CommandDef[] {
  const rng = deps.rng ?? Math.random;
  const now = () => (deps.now ? deps.now() : new Date());
  const cur = () => deps.currencyName();

  /* ---------------- coinflip ---------------- */
  interface CfChallenge { challenger: string; target: string; bet: number; expiresAt: number }

  const coinflip: CommandDef = {
    name: "coinflip",
    aliases: ["cf"],
    description: "Tung xu cược Coins với bot hoặc thách đấu người khác",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 3,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "").toLowerCase();
      if (sub === "accept" || sub === "reject") {
        const s = (await deps.sessions.get(ctx.userId, "coinflip")) as unknown as CfChallenge | null;
        if (!s || s.target !== ctx.userId) return { text: "Bạn không có lời thách tung xu nào đang chờ." };
        if (s.expiresAt < now().getTime()) {
          await deps.sessions.delete(s.challenger, "coinflip");
          await deps.sessions.delete(ctx.userId, "coinflip");
          await deps.economy.credit(s.challenger, s.bet, "coinflip", "Hoàn cược — thách đấu hết hạn");
          return { text: "Lời thách tung xu đã hết hạn, cược đã hoàn cho người thách." };
        }
        if (sub === "reject") {
          await deps.sessions.delete(s.challenger, "coinflip");
          await deps.sessions.delete(ctx.userId, "coinflip");
          await deps.economy.credit(s.challenger, s.bet, "coinflip", "Hoàn cược — bị từ chối");
          return { text: `Đã từ chối thách đấu tung xu của <@${s.challenger}>.` };
        }
        const ok = await deps.economy.debit(ctx.userId, s.bet, "coinflip", "Nhận thách tung xu");
        if (!ok) return { text: `Không đủ ${cur()} để nhận thách (cần ${fmt(s.bet)}).` };
        await deps.sessions.delete(s.challenger, "coinflip");
        await deps.sessions.delete(ctx.userId, "coinflip");
        const challengerWins = rng() < 0.5;
        const winner = challengerWins ? s.challenger : ctx.userId;
        await deps.economy.credit(winner, s.bet * 2, "coinflip", "Thắng thách tung xu");
        return {
          text: `Đồng xu: **${challengerWins ? "Sấp" : "Ngửa"}**! <@${winner}> thắng thách đấu, nhận ${fmt(s.bet * 2)} ${cur()}.`,
        };
      }

      const target = ctx.mentions[0];
      const bet = parseBet(ctx.args.find((a) => /^\d+$/.test(a)));
      if (target) {
        if (target === ctx.userId) return { text: "Không tự thách chính mình được." };
        if (!bet) return { text: `Cược tối thiểu ${MIN_BET} ${cur()} — ví dụ: coinflip @người 100.` };
        const existing = (await deps.sessions.get(target, "coinflip")) as unknown as CfChallenge | null;
        if (existing && existing.expiresAt > now().getTime()) {
          return { text: "Người ấy đang có một lời thách tung xu khác đang chờ." };
        }
        const ok = await deps.economy.debit(ctx.userId, bet, "coinflip", "Thách tung xu");
        if (!ok) return { text: `Không đủ ${cur()} (cần ${fmt(bet)}).` };
        const challenge: CfChallenge = {
          challenger: ctx.userId, target, bet, expiresAt: now().getTime() + CHALLENGE_TTL_MS,
        };
        await deps.sessions.set(ctx.userId, "coinflip", challenge as unknown as Record<string, unknown>);
        await deps.sessions.set(target, "coinflip", challenge as unknown as Record<string, unknown>);
        return {
          text: `<@${target}> — <@${ctx.userId}> thách tung xu cược **${fmt(bet)} ${cur()}**! Trả lời bằng \`coinflip accept\` hoặc \`coinflip reject\` trong 5 phút.`,
        };
      }

      const side = sub === "ngua" ? "ngua" : sub === "sap" ? "sap" : null;
      if (!side || !bet) {
        return { text: `Cách chơi: \`coinflip sap 100\` hoặc \`coinflip ngua 100\` đấu với bot, hay \`coinflip @người 100\` thách đấu. Cược tối thiểu ${MIN_BET}.` };
      }
      const ok = await deps.economy.debit(ctx.userId, bet, "coinflip", "Tung xu với bot");
      if (!ok) return { text: `Không đủ ${cur()} (cần ${fmt(bet)}).` };
      const landed = rng() < 0.5 ? "sap" : "ngua";
      if (landed === side) {
        await deps.economy.credit(ctx.userId, bet * 2, "coinflip", "Thắng tung xu");
        return { text: `Đồng xu: **${landed === "sap" ? "Sấp" : "Ngửa"}** — bạn đoán đúng, nhận ${fmt(bet * 2)} ${cur()}!` };
      }
      return { text: `Đồng xu: **${landed === "sap" ? "Sấp" : "Ngửa"}** — bạn đoán sai, mất ${fmt(bet)} ${cur()}.` };
    },
  };

  /* ---------------- blackjack ---------------- */
  const bjText = (s: BjState, reveal: boolean) =>
    `Nhà cái: ${formatHand(s.dealer, !reveal)}${reveal ? ` (${handValue(s.dealer)})` : ""}\n` +
    `Bạn: ${formatHand(s.player)} (${handValue(s.player)}) · cược ${fmt(s.bet)} ${cur()}`;

  const blackjack: CommandDef = {
    name: "blackjack",
    aliases: ["bj"],
    description: "Blackjack cược Coins — blackjack trả 3:2, nhà cái dằn ở 17",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 2,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "").toLowerCase();
      const existing = (await deps.sessions.get(ctx.userId, "blackjack")) as unknown as BjState | null;

      if (sub === "hit" || sub === "stand") {
        if (!existing || existing.phase !== "playing") {
          return { text: `Chưa có ván blackjack nào — bắt đầu bằng \`bj 100\`.` };
        }
        const next = sub === "hit" ? bjHit(existing, rng) : bjStand(existing, rng);
        if (next.phase === "done") {
          await deps.sessions.delete(ctx.userId, "blackjack");
          if ((next.payout ?? 0) > 0) {
            await deps.economy.credit(ctx.userId, next.payout!, "blackjack", `Blackjack: ${next.result}`);
          }
          const label = {
            blackjack: "BLACKJACK!", win: "Bạn thắng!", lose: "Nhà cái thắng.",
            push: "Hoà — hoàn cược.", bust: "Quắc (bust) — bạn thua.",
          }[next.result ?? "lose"];
          return { text: `${bjText(next, true)}\n**${label}**${(next.payout ?? 0) > 0 ? ` Nhận ${fmt(next.payout!)} ${cur()}.` : ""}` };
        }
        await deps.sessions.set(ctx.userId, "blackjack", next as unknown as Record<string, unknown>);
        return { text: `${bjText(next, false)}\n\`bj hit\` rút thêm · \`bj stand\` dừng.` };
      }

      const bet = parseBet(ctx.args[0]);
      if (!bet) return { text: `Cách chơi: \`bj 100\` để bắt đầu (cược tối thiểu ${MIN_BET}). Đang có ván dở thì \`bj hit\` / \`bj stand\`.` };
      if (existing?.phase === "playing") {
        return { text: `Bạn đang có ván blackjack cược ${fmt(existing.bet)} — \`bj hit\` hoặc \`bj stand\` trước đã.` };
      }
      const ok = await deps.economy.debit(ctx.userId, bet, "blackjack", "Đặt cược blackjack");
      if (!ok) return { text: `Không đủ ${cur()} (cần ${fmt(bet)}).` };
      const state = bjStart(bet, rng);
      if (state.phase === "done") {
        if ((state.payout ?? 0) > 0) {
          await deps.economy.credit(ctx.userId, state.payout!, "blackjack", "Blackjack ngay từ đầu");
        }
        return { text: `${bjText(state, true)}\n**${state.result === "blackjack" ? "BLACKJACK ngay từ đầu!" : "Cả hai cùng blackjack — hoà, hoàn cược."}** Nhận ${fmt(state.payout ?? 0)} ${cur()}.` };
      }
      await deps.sessions.set(ctx.userId, "blackjack", state as unknown as Record<string, unknown>);
      return { text: `${bjText(state, false)}\n\`bj hit\` rút thêm · \`bj stand\` dừng.` };
    },
  };

  /* ---------------- tic-tac-toe ---------------- */
  interface TttState {
    board: TttCell[];
    mode: "bot" | "pvp";
    difficulty: TttDifficulty;
    bet: number;
    xUser: string;
    oUser: string; // "BOT" when mode=bot
    turn: "X" | "O";
  }

  const tttFinish = async (s: TttState, text: string) => {
    await deps.sessions.delete(s.xUser, "tictactoe");
    if (s.mode === "pvp") await deps.sessions.delete(s.oUser, "tictactoe");
    return { text };
  };

  const tictactoe: CommandDef = {
    name: "tictactoe",
    aliases: ["ttt", "caro"],
    description: "Cờ caro 3x3 đấu bot (3 mức khó) hoặc thách đấu bạn bè",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 2,
    handler: async (ctx) => {
      const mine = (await deps.sessions.get(ctx.userId, "tictactoe")) as unknown as TttState | null;
      const arg = (ctx.args[0] ?? "").toLowerCase();

      if (/^[1-9]$/.test(arg) && mine) {
        const myMark: TttCell = mine.xUser === ctx.userId ? "X" : "O";
        if (mine.turn !== myMark) return { text: "Chưa tới lượt của bạn." };
        const idx = Number.parseInt(arg, 10) - 1;
        if (mine.board[idx] !== "") return { text: "Ô đó đã có quân rồi." };
        mine.board[idx] = myMark;
        let w = tttWinner(mine.board);
        if (w) {
          if (mine.mode === "pvp" && mine.bet > 0 && w !== "draw") {
            const winnerId = w === "X" ? mine.xUser : mine.oUser;
            await deps.economy.credit(winnerId, mine.bet * 2, "tictactoe", "Thắng caro thách đấu");
          }
          const endText = w === "draw"
            ? `${formatBoard(mine.board)}\nHoà! ${mine.bet > 0 && mine.mode === "pvp" ? "Cược của hai bên được hoàn." : ""}`
            : `${formatBoard(mine.board)}\n**${w === "X" ? `<@${mine.xUser}>` : mine.mode === "bot" ? "Bot" : `<@${mine.oUser}>`} thắng ván caro!**`;
          if (w === "draw" && mine.mode === "pvp" && mine.bet > 0) {
            await deps.economy.credit(mine.xUser, mine.bet, "tictactoe", "Hoàn cược caro hoà");
            await deps.economy.credit(mine.oUser, mine.bet, "tictactoe", "Hoàn cược caro hoà");
          }
          return tttFinish(mine, endText);
        }
        mine.turn = myMark === "X" ? "O" : "X";
        if (mine.mode === "bot") {
          const move = tttBotMove(mine.board, mine.difficulty, rng);
          if (move >= 0) mine.board[move] = "O";
          w = tttWinner(mine.board);
          mine.turn = "X";
          if (w) {
            return tttFinish(mine, `${formatBoard(mine.board)}\n${w === "draw" ? "Hoà với bot!" : w === "X" ? "**Bạn thắng bot!**" : "**Bot thắng ván này.**"}`);
          }
        } else {
          await deps.sessions.set(mine.xUser, "tictactoe", mine as unknown as Record<string, unknown>);
          await deps.sessions.set(mine.oUser, "tictactoe", mine as unknown as Record<string, unknown>);
          const nextUser = mine.turn === "X" ? mine.xUser : mine.oUser;
          return { text: `${formatBoard(mine.board)}\nTới lượt <@${nextUser}> — \`ttt <1-9>\`.` };
        }
        await deps.sessions.set(ctx.userId, "tictactoe", mine as unknown as Record<string, unknown>);
        return { text: `${formatBoard(mine.board)}\nTới lượt bạn — \`ttt <1-9>\`.` };
      }

      if (mine) return { text: `Bạn đang có ván caro dở:\n${formatBoard(mine.board)}\nĐánh bằng \`ttt <1-9>\`.` };

      const target = ctx.mentions[0];
      if (target) {
        if (target === ctx.userId) return { text: "Không tự đấu với chính mình được." };
        const bet = parseBet(ctx.args.find((a) => /^\d+$/.test(a))) ?? 0;
        if ((await deps.sessions.get(target, "tictactoe"))) {
          return { text: "Người ấy đang có ván caro khác rồi." };
        }
        if (bet > 0) {
          const ok = await deps.economy.debit(ctx.userId, bet, "tictactoe", "Cược caro thách đấu");
          if (!ok) return { text: `Không đủ ${cur()} (cần ${fmt(bet)}).` };
          const ok2 = await deps.economy.debit(target, bet, "tictactoe", "Nhận cược caro");
          if (!ok2) {
            await deps.economy.credit(ctx.userId, bet, "tictactoe", "Hoàn cược — đối thủ không đủ tiền");
            return { text: "Đối thủ không đủ tiền nhận cược — đã hoàn cược cho bạn." };
          }
        }
        const s: TttState = {
          board: Array(9).fill(""), mode: "pvp", difficulty: "medium",
          bet, xUser: ctx.userId, oUser: target, turn: "X",
        };
        await deps.sessions.set(ctx.userId, "tictactoe", s as unknown as Record<string, unknown>);
        await deps.sessions.set(target, "tictactoe", s as unknown as Record<string, unknown>);
        return {
          text: `Ván caro giữa <@${ctx.userId}> (X) và <@${target}> (O)${bet ? ` — cược ${fmt(bet)} ${cur()} mỗi bên` : ""}!\n${formatBoard(s.board)}\n<@${ctx.userId}> đi trước — \`ttt <1-9>\`.`,
        };
      }

      const difficulty: TttDifficulty = arg === "easy" ? "easy" : arg === "hard" ? "hard" : "medium";
      const s: TttState = {
        board: Array(9).fill(""), mode: "bot", difficulty,
        bet: 0, xUser: ctx.userId, oUser: "BOT", turn: "X",
      };
      await deps.sessions.set(ctx.userId, "tictactoe", s as unknown as Record<string, unknown>);
      return {
        text: `Ván caro với bot (độ khó: ${difficulty === "easy" ? "Dễ" : difficulty === "hard" ? "Khó" : "Thường"}). Bạn là X, đi trước:\n${formatBoard(s.board)}\nĐánh bằng \`ttt <1-9>\`.`,
      };
    },
  };

  /* ---------------- animal race ---------------- */
  const race: CommandDef = {
    name: "race",
    aliases: ["dua", "duathu"],
    description: "Đua thú cược Coins: race <ngua|tho|cho|meo|rua> <cược> — thắng trả theo hệ số",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const animalArg = (ctx.args[0] ?? "").toLowerCase();
      const animal = ANIMALS.find((a) => a.id === animalArg);
      const bet = parseBet(ctx.args[1]);
      if (!animal || !bet) {
        return {
          text:
            `Cách chơi: \`race <con> <cược>\` (cược tối thiểu ${MIN_BET}). Hệ số thắng:\n` +
            ANIMALS.map((a) => `${a.emoji} ${a.name} (\`${a.id}\`) ×${a.odds}`).join(" · "),
        };
      }
      const ok = await deps.economy.debit(ctx.userId, bet, "race", `Đua thú — cược ${animal.name}`);
      if (!ok) return { text: `Không đủ ${cur()} (cần ${fmt(bet)}).` };
      const result = simulateRace(rng);
      const track = formatRace(result);
      if (result.winner.id === animal.id) {
        const payout = Math.floor(bet * animal.odds);
        await deps.economy.credit(ctx.userId, payout, "race", `Đua thú — ${animal.name} về nhất`);
        return { text: `${track}\n🏁 **${result.winner.emoji} ${result.winner.name} về nhất!** Bạn cược đúng — nhận ${fmt(payout)} ${cur()} (×${animal.odds}).` };
      }
      return { text: `${track}\n🏁 **${result.winner.emoji} ${result.winner.name} về nhất!** Bạn cược ${animal.emoji} ${animal.name} — mất ${fmt(bet)} ${cur()}.` };
    },
  };

  return [coinflip, blackjack, tictactoe, race];
}
