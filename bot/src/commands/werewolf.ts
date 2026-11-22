/**
 * Werewolf commands (spec 6.16.4) — one command, subcommand routed:
 *
 *   masoi            trạng thái sảnh/ván ở kênh này + hướng dẫn
 *   masoi tao        mở sảnh ở kênh hiện tại        masoi vao   vào sảnh
 *   masoi roi        rời sảnh                        masoi batdau chủ sảnh bắt đầu
 *   masoi huy        chủ sảnh huỷ sảnh/ván
 *   masoi treo <số>  bỏ phiếu treo cổ (ở kênh, ban ngày)
 *   masoi hs         hồ sơ ma sói của bạn            masoi bxh   BXH server
 *   masoi bienban    biên bản ván gần nhất ở kênh này
 *
 * Night actions are DM-only (roles are secret): the player messages
 * the bot privately with the guild's prefix —
 *   masoi giet <số>  (sói)     masoi baove <số> (bảo vệ)
 *   masoi soi <số>   (tiên tri) masoi cuu / masoi doc <số> / masoi boqua (phù thuỷ)
 *   masoi ban <số>   (thợ săn bắn phát cuối)
 *
 * Announcements the engine emits for other targets (role DMs, phase
 * posts) go through the store outbox; the shard tick delivers them.
 * Werewolf never touches the economy (spec 6.16.4 — fame only).
 */
import type { CommandDef, CommandContext } from "@puni/shared";
import {
  DEFAULT_WW_CONFIG,
  advanceIfDue,
  cancelGame,
  castVote,
  createLobbyState,
  gameStatusText,
  hunterShot,
  joinLobby,
  leaveLobby,
  nightAction,
  startGame,
  witchAction,
  type WwConfig,
  type WwFx,
  type WwGame,
} from "../services/werewolf";
import type { WerewolfStore } from "../services/werewolf-store";

const HELP = [
  "🐺 **Ma sói** — game suy luận theo ván, chỉ tính danh vọng, không liên quan tới Coins.",
  "`masoi tao` mở sảnh · `masoi vao` vào sảnh · `masoi roi` rời sảnh · `masoi batdau` bắt đầu (chủ sảnh, tối thiểu 5 người)",
  "Ban ngày: `masoi treo <số>` bỏ phiếu treo cổ. Ban đêm: bot nhắn riêng vai cho bạn — hành động bằng lệnh nhắn riêng cho bot (giet/baove/soi/cuu/doc/ban).",
  "`masoi hs` hồ sơ · `masoi bxh` bảng xếp hạng server · `masoi bienban` biên bản ván trước · `masoi huy` huỷ (chủ sảnh)",
].join("\n");

export function createWerewolfCommands(deps: {
  store: WerewolfStore;
  configSource?: () => Promise<WwConfig>;
  rng?: () => number;
  now?: () => Date;
}): CommandDef[] {
  const store = deps.store;
  const cfgOf = deps.configSource ?? (async () => DEFAULT_WW_CONFIG);
  const rng = deps.rng ?? Math.random;
  const nowMs = () => (deps.now ? deps.now().getTime() : Date.now());

  /** Persist + fan out an engine result; returns text to fold into
   *  the caller's reply (announcements aimed at this very channel). */
  async function settle(game: WwGame, fx: WwFx, ctx: CommandContext): Promise<string[]> {
    await store.save(game);
    if (fx.finished && (await store.claimStats(game.id))) {
      await store.recordResult(game.guildId, fx.finished.winner, fx.finished.players);
    }
    const folded: string[] = [];
    const queued = [];
    for (const a of fx.announcements) {
      if (a.kind === "channel" && ctx.guildId && a.targetId === ctx.channelId) folded.push(a.text);
      else queued.push(a);
    }
    if (queued.length) await store.enqueue(queued);
    return folded;
  }

  const masoi: CommandDef = {
    name: "masoi",
    aliases: ["werewolf", "ww", "soi"],
    description: "Ma sói: mở sảnh, vào sảnh, chơi theo ván (chỉ tính danh vọng)",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    dmAllowed: true,
    handler: async (ctx) => {
      const cfg = await cfgOf();
      const sub = (ctx.args[0] ?? "").toLowerCase();
      const now = nowMs();
      const targetRaw = ctx.mentions[0] ?? ctx.args[1] ?? "";

      /* ---------- night actions: DM only ---------- */
      const nightSubs = ["giet", "baove", "soi", "cuu", "doc", "boqua", "ban"];
      if (nightSubs.includes(sub)) {
        if (ctx.guildId) {
          return { text: "🤫 Hành động ban đêm chỉ làm qua **tin nhắn riêng với bot** — vai của bạn là bí mật. Mở DM với bot rồi gõ lệnh tại đó." };
        }
        const game = await store.getActiveByPlayer(ctx.userId);
        if (!game) return { text: "Bạn không ở trong ván ma sói nào đang chơi." };
        // A stale phase may need the deadline applied before acting.
        const adv = advanceIfDue(game, cfg, now);
        if (adv.advanced) {
          const folded = await settle(game, adv.fx, ctx);
          if (game.status !== "playing") {
            return { text: folded.join("\n") || "Ván đã kết thúc." };
          }
        }
        let res;
        if (sub === "giet") res = nightAction(game, ctx.userId, "kill", targetRaw, cfg, now);
        else if (sub === "baove") res = nightAction(game, ctx.userId, "protect", targetRaw, cfg, now);
        else if (sub === "soi") res = nightAction(game, ctx.userId, "peek", targetRaw, cfg, now);
        else if (sub === "cuu") res = witchAction(game, ctx.userId, "save", null, cfg, now);
        else if (sub === "doc") res = witchAction(game, ctx.userId, "poison", targetRaw, cfg, now);
        else if (sub === "ban") res = hunterShot(game, ctx.userId, targetRaw || null, cfg, now);
        else {
          // boqua: witch skip or hunter skip, by phase
          res = game.state.phase === "hunter"
            ? hunterShot(game, ctx.userId, null, cfg, now)
            : witchAction(game, ctx.userId, "skip", null, cfg, now);
        }
        if (!res.ok) return { text: res.error ?? "Không làm được." };
        const folded = await settle(game, res.fx, ctx);
        return { text: [res.reply ?? "Đã ghi nhận.", ...folded].filter(Boolean).join("\n") };
      }

      /* ---------- profile / leaderboard: anywhere ---------- */
      if (sub === "hs" || sub === "hoso") {
        const stats = ctx.guildId
          ? await store.getStats(ctx.guildId, ctx.userId)
          : await store.getStatsAllGuilds(ctx.userId);
        if (!stats || stats.games === 0) {
          return { text: "🐺 Bạn chưa chơi ván ma sói nào. Mở sảnh bằng `masoi tao` ở một kênh nhé!" };
        }
        return {
          text: `🐺 **Hồ sơ ma sói của <@${ctx.userId}>**${ctx.guildId ? "" : " (mọi server)"}: **${stats.games}** ván · thắng **${stats.wins}** · phe sói ${stats.wolfWins}/${stats.wolfGames} thắng · phe dân ${stats.villageWins}/${stats.villageGames} thắng.`,
        };
      }

      /* ---------- everything else needs a guild channel ---------- */
      if (!ctx.guildId) return { text: HELP };

      if (sub === "bxh" || sub === "top") {
        const rows = await store.leaderboard(ctx.guildId, 10);
        if (!rows.length) return { text: "🐺 Server này chưa có ván ma sói nào hoàn thành." };
        const lines = rows.map((r, i) =>
          `**${i + 1}.** <@${r.userId}> — thắng **${r.wins}**/${r.games} ván (sói ${r.wolfWins}/${r.wolfGames} · dân ${r.villageWins}/${r.villageGames})`);
        return { text: `🐺 **BXH ma sói của server**\n${lines.join("\n")}` };
      }

      if (sub === "bienban") {
        const last = await store.lastFinishedByChannel(ctx.channelId);
        if (!last) return { text: "Kênh này chưa có ván ma sói nào kết thúc." };
        const log = last.state.log.slice(-30).join("\n");
        return { text: `📜 **Biên bản ván ma sói gần nhất**\n${log}` };
      }

      if (sub === "tao" || sub === "create") {
        const existing = await store.getActiveByChannel(ctx.channelId);
        if (existing) return { text: "Kênh này đang có một sảnh/ván ma sói rồi — xem bằng `masoi`." };
        const mine = await store.getActiveByPlayer(ctx.userId);
        if (mine) return { text: "Bạn đang ở trong một sảnh/ván ma sói khác — rời hoặc chờ ván đó kết thúc đã." };
        const state = createLobbyState({ userId: ctx.userId, name: `<@${ctx.userId}>` });
        const game = await store.createGame(ctx.guildId, ctx.channelId, ctx.userId, state);
        return {
          text: `🐺 **Sảnh ma sói đã mở!** (sảnh #${game.id})\nNgười chơi khác vào bằng \`masoi vao\` — đủ ${cfg.minPlayers} người thì chủ sảnh gõ \`masoi batdau\`.\n${gameStatusText(game, cfg)}`,
        };
      }

      // All remaining subs act on the channel's active game.
      const game = await store.getActiveByChannel(ctx.channelId);
      if (!game) {
        if (sub === "") return { text: `Kênh này chưa có sảnh ma sói nào.\n${HELP}` };
        return { text: "Kênh này chưa có sảnh ma sói nào — mở bằng `masoi tao`." };
      }
      // Apply a due phase transition before serving the action.
      if (game.status === "playing") {
        const adv = advanceIfDue(game, cfg, now);
        if (adv.advanced) await settle(game, adv.fx, ctx);
      }

      if (sub === "" || sub === "status") {
        return { text: gameStatusText(game, cfg) };
      }
      if (sub === "vao" || sub === "join") {
        const mine = await store.getActiveByPlayer(ctx.userId);
        if (mine && mine.id !== game.id) {
          return { text: "Bạn đang ở trong một sảnh/ván ma sói khác — rời hoặc chờ ván đó kết thúc đã." };
        }
        const res = joinLobby(game, { userId: ctx.userId, name: `<@${ctx.userId}>` }, cfg);
        if (!res.ok) return { text: res.error ?? "Không vào được sảnh." };
        const folded = await settle(game, res.fx, ctx);
        return { text: folded.join("\n") || "Đã vào sảnh." };
      }
      if (sub === "roi" || sub === "leave") {
        const res = leaveLobby(game, ctx.userId);
        if (!res.ok) return { text: res.error ?? "Không rời được sảnh." };
        if (res.empty) {
          game.status = "cancelled";
          const folded = await settle(game, res.fx, ctx);
          return { text: [...folded, "Sảnh trống nên đã đóng."].join("\n") };
        }
        let hostNote = "";
        if (game.hostId === ctx.userId) {
          game.hostId = game.state.players[0].userId;
          hostNote = `👑 Chủ sảnh mới: <@${game.hostId}>.`;
        }
        const folded = await settle(game, res.fx, ctx);
        return { text: [...folded, hostNote].filter(Boolean).join("\n") || "Đã rời sảnh." };
      }
      if (sub === "batdau" || sub === "start") {
        if (game.hostId !== ctx.userId) return { text: "Chỉ chủ sảnh mới bắt đầu ván được." };
        const res = startGame(game, cfg, rng, now);
        if (!res.ok) return { text: res.error ?? "Chưa bắt đầu được." };
        const folded = await settle(game, res.fx, ctx);
        return { text: folded.join("\n") || "Ván đã bắt đầu!" };
      }
      if (sub === "huy" || sub === "cancel") {
        if (game.hostId !== ctx.userId) return { text: "Chỉ chủ sảnh mới huỷ được." };
        const fx = cancelGame(game, ctx.userId);
        const folded = await settle(game, fx, ctx);
        return { text: folded.join("\n") || "Đã huỷ ván." };
      }
      if (sub === "treo" || sub === "vote") {
        const res = castVote(game, ctx.userId, targetRaw, cfg, now);
        if (!res.ok) return { text: res.error ?? "Không bỏ phiếu được." };
        const folded = await settle(game, res.fx, ctx);
        return { text: folded.join("\n") || res.reply || "Đã bỏ phiếu." };
      }
      return { text: HELP };
    },
  };

  return [masoi];
}
