/**
 * TCG commands (spec 6.23): hub + inventory/collection/currency/
 * weekly/achievements/leaderboard/settings + the grouped commands
 * gacha / card / deck / market / trade (subcommand = first arg,
 * exactly like the prefix form `!gacha multi`).
 */
import type { CommandDef } from "@puni/shared";
import {
  ACHIEVEMENTS,
  BASE_VALUE,
  BURN_SHARDS,
  MAX_ENHANCE,
  MAX_LEVEL,
  bannerActive,
  inBannerPool,
  enhanceCost,
  rarityRank,
  speciesEdition,
  upgradeCost,
  validateDeck,
  type CardInstance,
  type TcgConfig,
  type TcgSpecies,
  type TcgStats,
  cardValueCoins,
  snapMoney,
  type TcgRarity,
} from "../services/tcg";
import type { TcgGameService, TcgEconomyHooks } from "../services/tcg-store";
import type { TcgStore } from "../services/tcg-store";
import {
  CHAIN_WINS,
  DRAFT_ROUNDS,
  ENTRY_FEE_COINS,
  WIN_COINS,
  speciesPower,
  type FormatRun,
  type TcgFormatsGame,
} from "../services/tcg-formats";
import {
  QUEST_BONUS_COINS,
  QUEST_BONUS_SHARDS,
  type TcgQuestsGame,
} from "../services/tcg-quests";
import {
  TcgSocialGame, roundName as socialRoundName,
} from "../services/tcg-social";

export interface TcgCommandDeps {
  game: TcgGameService;
  formats: TcgFormatsGame;
  quests: TcgQuestsGame;
  social: TcgSocialGame;
  store: TcgStore;
  catalog: () => Promise<TcgSpecies[]>;
  config: () => Promise<TcgConfig>;
  economy: TcgEconomyHooks;
  currencyName: () => string;
  /** Public base URL of the dashboard (card images), "" = no images. */
  cardBaseUrl: string;
  /** Membership perks resolver (spec 6.19 TCG benefits). */
  memberPerks?: (userId: string) => Promise<import("../services/membership").EffectivePerks | null>;
  now?: () => Date;
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const RARITY_TAG: Record<string, string> = {
  Common: "Thường", Uncommon: "Ít gặp", Rare: "Hiếm", Epic: "Sử thi",
  Legendary: "Huyền thoại", Mythical: "Thần thoại", Fabled: "Truyền thuyết",
};

export function createTcgCommands(deps: TcgCommandDeps): CommandDef[] {
  const now = () => (deps.now ? deps.now() : new Date());
  const speciesMap = async () => {
    const map = new Map<string, TcgSpecies>();
    for (const s of await deps.catalog()) map.set(s.id, s);
    return map;
  };
  const deckCodesOf = async (userId: string): Promise<Set<string>> => {
    const decks = await deps.store.listDecks(userId);
    return new Set(decks.flatMap((d) => d.codes));
  };
  const statsOf = async (userId: string): Promise<TcgStats> => {
    const [instances, decks, listings, totalPulls, catalog, cfg] = await Promise.all([
      deps.store.listInstances(userId),
      deps.store.listDecks(userId),
      deps.store.listingsOf(userId),
      deps.store.totalPullsAll(userId),
      deps.catalog(),
      deps.config(),
    ]);
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const instSpecies = instances.map((i) => i.speciesId);
    const rules = { size: cfg.deckSize, maxCopies: cfg.deckMaxCopies, minSpecies: cfg.deckMinSpecies };
    const validDecks = decks.filter(
      (d) => validateDeck(d.codes.map((c) => instances.find((i) => i.code === c)?.speciesId ?? "?"), rules).length === 0,
    ).length;
    const sold = listings.filter((l) => l.status === "sold");
    return {
      totalPulls,
      speciesOwned: new Set(instSpecies).size,
      totalSpecies: catalog.length,
      hasLegendary: instSpecies.some((id) => rarityRank(byId.get(id)?.rarity ?? "Common") >= rarityRank("Legendary")),
      hasFabled: instSpecies.some((id) => byId.get(id)?.rarity === "Fabled"),
      validDecks,
      salesCount: sold.length,
      salesCoins: sold.reduce((s, l) => s + l.price, 0),
    };
  };
  const describeInstance = async (inst: CardInstance): Promise<string> => {
    const sp = (await speciesMap()).get(inst.speciesId);
    const name = sp?.name ?? inst.speciesId;
    const rarity = sp?.rarity ?? "Common";
    return `\`${inst.code}\` **${name}** (${RARITY_TAG[rarity] ?? rarity}) · Lv.${inst.level} +${inst.enhance}` +
      `${inst.locked ? " · Đã khoá" : ""}${inst.favorite ? " · Yêu thích" : ""}`;
  };

  const defs: CommandDef[] = [
    {
      name: "tcg",
      description: "Trung tâm game thẻ TCG: số dư, gói, bộ sưu tập",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const [wallet, instances, banners, cfg] = await Promise.all([
          deps.store.wallet(ctx.userId),
          deps.store.listInstances(ctx.userId),
          deps.store.listBanners(),
          deps.config(),
        ]);
        const coins = await deps.economy.balance(ctx.userId);
        const species = new Set(instances.map((i) => i.speciesId)).size;
        const active = banners.filter((b) => bannerActive(b, now()));
        const lines = [
          `**Trung tâm TCG của <@${ctx.userId}>**`,
          `Số dư: **${fmt(coins)}** ${deps.currencyName()} · **${fmt(wallet.shards)}** Mảnh thẻ`,
          `Gói chưa mở: **${wallet.packsStandard}** gói thường · **${wallet.packsPremium}** gói cao cấp`,
          `Thẻ sở hữu: **${instances.length}** lá (${species} loài khác nhau)`,
          `Banner đang mở: ${active.map((b) => b.name).join(", ") || "không có"}`,
          "",
          "Cửa vào: `gacha` mở thẻ · `card` quản lý thẻ · `deck` bộ bài · `market` chợ · `trade` trao đổi",
          "`inventory` kho · `collection` bộ sưu tập · `weekly` quà tuần · `achievements` thành tựu · `leaderboard` bảng xếp hạng",
          `Mở 1 thẻ: ${fmt(cfg.pullCostCoins)} ${deps.currencyName()} · Mở 10 được đảm bảo ít nhất 1 thẻ Hiếm.`,
        ];
        return { text: lines.join("\n") };
      },
    },
    {
      name: "inventory",
      aliases: ["kho", "tui"],
      description: "Kho thẻ và vật phẩm TCG",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const [wallet, instances] = await Promise.all([
          deps.store.wallet(ctx.userId),
          deps.store.listInstances(ctx.userId),
        ]);
        const recent = instances.slice(0, 10);
        const lines = [
          `**Kho của <@${ctx.userId}>**`,
          `Mảnh thẻ: **${fmt(wallet.shards)}** · Gói thường: **${wallet.packsStandard}** · Gói cao cấp: **${wallet.packsPremium}**`,
          `Tổng số thẻ: **${instances.length}** lá`,
        ];
        if (recent.length) {
          lines.push("", "Thẻ mới nhất:");
          for (const inst of recent) lines.push(await describeInstance(inst));
        } else {
          lines.push("", "Chưa có thẻ nào — dùng lệnh `gacha single` để mở lá đầu tiên.");
        }
        return { text: lines.join("\n"), ephemeral: true };
      },
    },
    {
      name: "collection",
      aliases: ["bosuutap"],
      description: "Bộ sưu tập thẻ: tiến độ loài và độ hiếm",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const [instances, catalog] = await Promise.all([
          deps.store.listInstances(ctx.userId),
          deps.catalog(),
        ]);
        const byId = new Map(catalog.map((s) => [s.id, s]));
        const owned = new Map<string, number>();
        for (const i of instances) owned.set(i.speciesId, (owned.get(i.speciesId) ?? 0) + 1);
        const byRarity = new Map<string, number>();
        let value = 0;
        for (const [id, n] of owned) {
          const r = byId.get(id)?.rarity ?? "Common";
          byRarity.set(r, (byRarity.get(r) ?? 0) + n);
          value += (BASE_VALUE[r as keyof typeof BASE_VALUE] ?? 0) * n;
        }
        const lines = [
          `**Bộ sưu tập của <@${ctx.userId}>**`,
          `Đã có ${owned.size}/${catalog.length} loài · ${instances.length} lá thẻ · Giá trị tham khảo: **${fmt(value)}** ${deps.currencyName()}`,
        ];
        for (const r of ["Fabled", "Mythical", "Legendary", "Epic", "Rare", "Uncommon", "Common"]) {
          if (byRarity.has(r)) lines.push(`${RARITY_TAG[r]}: **${byRarity.get(r)}** lá`);
        }
        const query = (ctx.args[0] ?? "").toLowerCase();
        if (query) {
          const hits = catalog.filter((s) => s.name.toLowerCase().includes(query) || s.id.includes(query)).slice(0, 10);
          lines.push("", hits.length
            ? hits.map((s) => `${owned.has(s.id) ? "Có" : "Chưa có"} — **${s.name}** (${RARITY_TAG[s.rarity]}) ×${owned.get(s.id) ?? 0}`).join("\n")
            : "Không tìm thấy loài nào khớp.");
        }
        return { text: lines.join("\n"), ephemeral: true };
      },
    },
    {
      name: "currency",
      aliases: ["tiente"],
      description: "Xem số dư tiền tệ và nguyên liệu TCG",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const [coins, wallet, banners] = await Promise.all([
          deps.economy.balance(ctx.userId),
          deps.store.wallet(ctx.userId),
          deps.store.listBanners(),
        ]);
        let points = 0;
        for (const b of banners) points += (await deps.store.getPity(ctx.userId, b.id)).summonPoints;
        return {
          text: `<@${ctx.userId}> — **${fmt(coins)}** ${deps.currencyName()} · **${fmt(wallet.shards)}** Mảnh thẻ · **${fmt(points)}** Điểm triệu hồi · Gói: ${wallet.packsStandard} thường / ${wallet.packsPremium} cao cấp`,
        };
      },
    },
    {
      name: "weekly",
      aliases: ["quatuan"],
      description: "Nhận thưởng TCG hàng tuần: 3 gói + Coins + Mảnh",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      cooldownSec: 5,
      handler: async (ctx) => {
        const d = now();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const period = `${monday.getFullYear()}-W${monday.toISOString().slice(0, 10)}`;
        const first = await deps.store.claimOnce(ctx.userId, "weekly", period);
        if (!first) return { text: "Bạn đã nhận quà tuần này rồi — quay lại vào tuần sau nhé." };
        await deps.store.adjustWallet(ctx.userId, { packsStandard: 3, shards: 20 });
        await deps.economy.credit(ctx.userId, 2000, "tcg-weekly", "Quà tuần TCG");
        return { text: `Quà tuần TCG: **3 Gói Thường** + **2.000** ${deps.currencyName()} + **20** Mảnh thẻ. Mở gói bằng lệnh \`gacha pack\`.` };
      },
    },
    {
      name: "achievements",
      aliases: ["thanhtuu"],
      description: "Thành tựu TCG và phần thưởng",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const stats = await statsOf(ctx.userId);
        const claimed = new Set(await deps.store.claimedAchievements(ctx.userId));
        const lines = [`**Thành tựu TCG của <@${ctx.userId}>**`];
        const newly: string[] = [];
        for (const def of ACHIEVEMENTS) {
          if (def.met(stats) && !claimed.has(def.id)) {
            await deps.store.claimAchievement(ctx.userId, def.id);
            if (def.reward.coins) await deps.economy.credit(ctx.userId, def.reward.coins, "tcg-achievement", def.name);
            if (def.reward.packs || def.reward.shards) {
              await deps.store.adjustWallet(ctx.userId, { packsStandard: def.reward.packs ?? 0, shards: def.reward.shards ?? 0 });
            }
            newly.push(def.name);
            claimed.add(def.id);
          }
          lines.push(`${claimed.has(def.id) ? "Đã đạt" : "Chưa đạt"} — ${def.name} (${def.progress(stats)})`);
        }
        if (newly.length) lines.push("", `Vừa mở khoá: ${newly.join(", ")} — thưởng đã cộng.`);
        return { text: lines.join("\n"), ephemeral: true };
      },
    },
    {
      name: "leaderboard",
      aliases: ["bxh"],
      description: "Bảng xếp hạng nhà sưu tập TCG",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const top = await deps.store.topCollectors(10);
        if (!top.length) return { text: "Chưa có nhà sưu tập nào — hãy là người đầu tiên mở thẻ." };
        const lines = ["**Bảng xếp hạng sưu tập TCG**"];
        top.forEach((row, i) => {
          lines.push(`${i + 1}. <@${row.userId}> — ${row.species} loài · ${row.instances} lá`);
        });
        return { text: lines.join("\n") };
      },
    },
    {
      name: "settings",
      aliases: ["caidat"],
      description: "Cài đặt cá nhân TCG: settings [private|trade] [on|off]",
      module: "cozy",
      permission: "everyone",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        const prefs = await deps.store.getPrefs(ctx.userId);
        const [key, val] = [ctx.args[0]?.toLowerCase(), ctx.args[1]?.toLowerCase()];
        if (key === "private" || key === "trade") {
          if (val !== "on" && val !== "off") return { text: `Dùng: \`settings ${key} on\` hoặc \`settings ${key} off\`.` };
          prefs[key === "private" ? "privateCollection" : "acceptTrades"] = val === "on";
          await deps.store.setPrefs(ctx.userId, prefs);
          return { text: "Đã lưu cài đặt TCG." };
        }
        return {
          text: [
            "**Cài đặt TCG của bạn**",
            `Bộ sưu tập riêng tư: ${prefs.privateCollection ? "Bật" : "Tắt"} (đổi: \`settings private on/off\`)`,
            `Nhận lời trao đổi: ${prefs.acceptTrades === false ? "Tắt" : "Bật"} (đổi: \`settings trade on/off\`)`,
          ].join("\n"),
          ephemeral: true,
        };
      },
    },
  ];

  return defs;
}

/** Grouped TCG commands: gacha / card / deck / market / trade. */
export function createTcgGroupCommands(deps: TcgCommandDeps): CommandDef[] {
  const now = () => (deps.now ? deps.now() : new Date());
  /** Daily-quest progress hook (spec 6.38) — fail-open by design. */
  const bump = async (userId: string, action: string, n = 1): Promise<void> => {
    try {
      await deps.quests.bump(userId, action, n);
    } catch {
      /* quests never break gameplay */
    }
  };
  const speciesMap = async () => {
    const map = new Map<string, TcgSpecies>();
    for (const s of await deps.catalog()) map.set(s.id, s);
    return map;
  };
  const deckCodesOf = async (userId: string): Promise<Set<string>> => {
    const decks = await deps.store.listDecks(userId);
    return new Set(decks.flatMap((d) => d.codes));
  };
  const pullText = (title: string, results: { species: TcgSpecies; rarity: string; instance: CardInstance }[]) => {
    const lines = [`**${title}**`];
    for (const r of results) {
      lines.push(`\`${r.instance.code}\` **${r.species.name}** — ${RARITY_TAG[r.rarity] ?? r.rarity}`);
    }
    const best = [...results].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
    if (best && rarityRank(best.rarity) >= rarityRank("Epic")) {
      lines.push(`Lá nổi bật nhất: **${best.species.name}** (${RARITY_TAG[best.rarity]})`);
    }
    return lines.join("\n");
  };
  const ownInstance = async (userId: string, code: string) => {
    const inst = await deps.store.getInstance((code ?? "").toUpperCase());
    return inst && inst.userId === userId ? inst : null;
  };

  const gacha: CommandDef = {
    name: "gacha",
    aliases: ["triehoi"],
    description: "Gacha TCG: gacha [single|multi|banner|history|pity|rates|exchange|free|pack]",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 2,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "banner").toLowerCase();
      const bannerId = ctx.args[1]?.toLowerCase() || "standard";
      const cfg = await deps.config();
      if (sub === "single" || sub === "multi") {
        const out = await deps.game.pull(ctx.userId, bannerId, sub === "multi" ? 10 : 1);
        if (out.kind === "error") return { text: out.message };
        const best = [...out.results].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0]!;
        return {
          text: pullText(`<@${ctx.userId}> mở ${out.results.length} thẻ (banner ${bannerId}) — tốn ${fmt(out.cost)} ${deps.currencyName()}`, out.results),
          imageUrl: deps.cardBaseUrl && rarityRank(best.rarity) >= rarityRank("Rare")
            ? `${deps.cardBaseUrl}/cards/${best.species.id}.png`
            : undefined,
        };
      }
      if (sub === "pack" || sub === "packpremium") {
        const out = await deps.game.openPack(ctx.userId, sub === "packpremium");
        if (out.kind === "error") return { text: out.message };
        return { text: pullText(`<@${ctx.userId}> mở gói ${sub === "packpremium" ? "cao cấp" : "thường"}`, out.results) };
      }
      if (sub === "free") {
        const period = now().toISOString().slice(0, 10);
        const first = await deps.store.claimOnce(ctx.userId, "daily", period);
        if (!first) return { text: "Bạn đã nhận gói miễn phí hôm nay rồi." };
        const perks = deps.memberPerks
          ? await deps.memberPerks(ctx.userId).catch(() => null)
          : null;
        const packs = 1 + (perks?.extraFreePacksPerDay ?? 0);
        await deps.store.adjustWallet(ctx.userId, { packsStandard: packs });
        return {
          text:
            "Đã nhận **" + packs + " Gói Thường** miễn phí hôm nay. Mở bằng `gacha pack`." +
            (packs > 1 ? " (Đã cộng thêm gói hội viên.)" : ""),
        };
      }
      if (sub === "banner") {
        const banners = (await deps.store.listBanners()).filter((b) => bannerActive(b, now()));
        if (!banners.length) return { text: "Hiện không có banner nào đang mở." };
        return {
          text: banners.map((b) =>
            `**${b.name}** (\`${b.id}\`) — ${fmt(b.kind === "beginner" ? cfg.beginnerCostCoins : b.costCoins || cfg.pullCostCoins)} ${deps.currencyName()}/lượt` +
            (b.featuredSpecies.length ? ` · Rate-up: ${b.featuredSpecies.join(", ")}` : "") +
            (b.endsAt ? ` · Kết thúc ${b.endsAt.toLocaleDateString("vi-VN")}` : ""),
          ).join("\n"),
        };
      }
      if (sub === "rates") {
        const rows = Object.entries(cfg.rates).map(([r, v]) => `${RARITY_TAG[r] ?? r}: ${v}%`);
        return { text: `**Tỷ lệ mở thẻ**\n${rows.join(" · ")}\nBảo hiểm: ${cfg.pityEpic} lượt chắc chắn Sử thi+, ${cfg.pityLegendary} lượt chắc chắn Huyền thoại+. Mở 10 luôn có ít nhất 1 thẻ Hiếm.` };
      }
      if (sub === "pity") {
        const id = ctx.args[1]?.toLowerCase() || "standard";
        const pity = await deps.store.getPity(ctx.userId, id);
        return {
          text: `Banner \`${id}\`: đã mở ${pity.totalPulls} lượt · còn tối đa ${Math.max(0, cfg.pityEpic - pity.sinceEpic)} lượt tới Sử thi, ${Math.max(0, cfg.pityLegendary - pity.sinceLegendary)} lượt tới Huyền thoại · Điểm triệu hồi: **${pity.summonPoints}**/${cfg.exchangePoints}`,
          ephemeral: true,
        };
      }
      if (sub === "history") {
        const rows = await deps.store.pullHistory(ctx.userId, 10);
        if (!rows.length) return { text: "Bạn chưa mở thẻ lần nào." };
        const map = await speciesMap();
        return {
          text: rows.map((r) => `${r.at.toLocaleDateString("vi-VN")} — **${map.get(r.speciesId)?.name ?? r.speciesId}** (${RARITY_TAG[r.rarity] ?? r.rarity}) [${r.bannerId}]`).join("\n"),
          ephemeral: true,
        };
      }
      if (sub === "exchange") {
        const speciesId = ctx.args[1]?.toLowerCase();
        const id = ctx.args[2]?.toLowerCase() || "standard";
        const banner = await deps.store.getBanner(id);
        if (!banner || !bannerActive(banner, now())) return { text: "Banner không còn mở." };
        const species = (await speciesMap()).get(speciesId ?? "");
        if (!species) return { text: "Không tìm thấy loài thẻ đó. Xem danh sách bằng `collection <tên>`." };
        if (!inBannerPool(banner, species.id)) {
          return { text: "Loài này không nằm trong pool của banner." };
        }
        const pity = await deps.store.getPity(ctx.userId, id);
        if (pity.summonPoints < cfg.exchangePoints) {
          return { text: `Chưa đủ điểm: ${pity.summonPoints}/${cfg.exchangePoints} Điểm triệu hồi (mỗi lượt mở +1).` };
        }
        pity.summonPoints -= cfg.exchangePoints;
        await deps.store.savePity(ctx.userId, id, pity);
        const inst = await deps.store.createInstance(ctx.userId, species.id, "exchange");
        return { text: `Đổi điểm thành công: \`${inst.code}\` **${species.name}** (${RARITY_TAG[species.rarity]}) về kho của bạn.` };
      }
      return { text: "Dùng: `gacha single|multi [banner]` · `gacha pack` mở gói · `gacha free` gói ngày · `gacha banner|rates|pity|history` · `gacha exchange <mã loài> [banner]`" };
    },
  };

  const card: CommandDef = {
    name: "card",
    aliases: ["the"],
    description: "Quản lý thẻ: card [view|search|favorite|lock|unlock|upgrade|enhance|evolve|burn] <mã>",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "view").toLowerCase();
      const arg = ctx.args[1] ?? "";
      const map = await speciesMap();
      if (sub === "search") {
        const q = ctx.args.slice(1).join(" ").toLowerCase();
        const hits = [...map.values()].filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 12);
        return { text: hits.length ? hits.map((s) => `**${s.name}** (\`${s.id}\`) — ${RARITY_TAG[s.rarity]}`).join("\n") : "Không tìm thấy thẻ nào khớp.", ephemeral: true };
      }
      const inst = await ownInstance(ctx.userId, arg);
      if (!inst) return { text: "Không tìm thấy thẻ đó trong kho của bạn. Mã thẻ là mã 8 ký tự, xem bằng `inventory`." };
      const sp = map.get(inst.speciesId);
      const rarity = sp?.rarity ?? "Common";
      if (sub === "view" || sub === "inspect") {
        const cfg = await deps.config();
        const base = sp ? (BASE_VALUE[rarity as keyof typeof BASE_VALUE] ?? 0) : 0;
        const lines = [
          `**${sp?.name ?? inst.speciesId}** — ${RARITY_TAG[rarity]}`,
          `Mã thẻ: \`${inst.code}\` · Cấp ${inst.level} · Cường hoá +${inst.enhance} · Nguồn: ${inst.obtained}`,
          `Giá trị của lá này: ${fmt(cardValueCoins(rarity as TcgRarity, inst.level, inst.enhance, sp?.priceUsd, cfg.priceCoinsPerUsd, sp?.marketPriceCoins))} ${deps.currencyName()} · Bán cho hệ thống: ${fmt(snapMoney((cardValueCoins(rarity as TcgRarity, inst.level, inst.enhance, sp?.priceUsd, cfg.priceCoinsPerUsd, sp?.marketPriceCoins) * cfg.sellRatePercent) / 100))} · Phân giải được ${BURN_SHARDS[rarity as keyof typeof BURN_SHARDS] ?? 1} Mảnh`,
          inst.locked ? "Đang khoá (không bán/trade/phân giải được)." : "Chưa khoá.",
          inst.favorite ? "Đã đánh dấu yêu thích." : "",
          sp?.evolvesTo ? `Tiến hoá thành: **${map.get(sp.evolvesTo)?.name ?? sp.evolvesTo}** (lệnh \`card evolve ${inst.code}\`)` : "",
        ].filter(Boolean);
        return {
          text: lines.join("\n"),
          imageUrl: deps.cardBaseUrl ? `${deps.cardBaseUrl}/cards/${inst.speciesId}.png` : undefined,
          ephemeral: true,
        };
      }
      if (sub === "favorite") {
        await deps.store.updateInstance(inst.code, { favorite: !inst.favorite });
        return { text: inst.favorite ? "Đã bỏ yêu thích." : "Đã đánh dấu yêu thích." };
      }
      if (sub === "lock") { await deps.store.updateInstance(inst.code, { locked: true }); return { text: "Đã khoá thẻ." }; }
      if (sub === "unlock") { await deps.store.updateInstance(inst.code, { locked: false }); return { text: "Đã mở khoá thẻ." }; }
      if (sub === "upgrade") {
        if (inst.level >= MAX_LEVEL) return { text: "Thẻ đã đạt cấp tối đa." };
        const cost = upgradeCost(inst.level);
        const wallet = await deps.store.wallet(ctx.userId);
        if (wallet.shards < cost) return { text: `Cần ${cost} Mảnh thẻ để nâng cấp (đang có ${wallet.shards}). Phân giải thẻ thừa bằng \`card burn <mã>\`.` };
        await deps.store.adjustWallet(ctx.userId, { shards: -cost });
        await deps.store.updateInstance(inst.code, { level: inst.level + 1 });
        return { text: `Đã nâng **${sp?.name ?? inst.speciesId}** lên cấp ${inst.level + 1} (−${cost} Mảnh).` };
      }
      if (sub === "enhance") {
        if (inst.enhance >= MAX_ENHANCE) return { text: "Thẻ đã cường hoá tối đa (+10)." };
        const cost = enhanceCost(inst.enhance);
        const wallet = await deps.store.wallet(ctx.userId);
        if (wallet.shards < cost) return { text: `Cần ${cost} Mảnh thẻ để cường hoá (đang có ${wallet.shards}).` };
        await deps.store.adjustWallet(ctx.userId, { shards: -cost });
        await deps.store.updateInstance(inst.code, { enhance: inst.enhance + 1 });
        await bump(ctx.userId, "enhance");
        return { text: `Đã cường hoá **${sp?.name ?? inst.speciesId}** lên +${inst.enhance + 1} (−${cost} Mảnh).` };
      }
      if (sub === "evolve") {
        if (!sp?.evolvesTo) return { text: "Loài này không có dạng tiến hoá." };
        if (inst.locked) return { text: "Thẻ đang khoá — mở khoá trước khi tiến hoá." };
        const cost = (BURN_SHARDS[rarity as keyof typeof BURN_SHARDS] ?? 1) * 2;
        const wallet = await deps.store.wallet(ctx.userId);
        if (wallet.shards < cost) return { text: `Tiến hoá cần ${cost} Mảnh thẻ (đang có ${wallet.shards}).` };
        await deps.store.adjustWallet(ctx.userId, { shards: -cost });
        await deps.store.deleteInstance(inst.code);
        const next = await deps.store.createInstance(ctx.userId, sp.evolvesTo, "evolve");
        await deps.store.updateInstance(next.code, { level: inst.level });
        await bump(ctx.userId, "evolve");
        const target = map.get(sp.evolvesTo);
        return { text: `Tiến hoá thành công: **${sp.name}** → **${target?.name ?? sp.evolvesTo}** (\`${next.code}\`, giữ cấp ${inst.level}).` };
      }
      if (sub === "burn") {
        const out = await deps.game.burn(ctx.userId, inst.code, await deckCodesOf(ctx.userId));
        if (out.kind === "error") return { text: out.message };
        return { text: `Đã phân giải **${sp?.name ?? inst.speciesId}** → +${out.shards} Mảnh thẻ.` };
      }
      if (sub === "sell") {
        const cfg = await deps.config();
        const out = await deps.game.sellCard(ctx.userId, inst.code, await deckCodesOf(ctx.userId));
        if (out.kind === "error") return { text: out.message };
        return { text: `Đã bán **${sp?.name ?? inst.speciesId}** (\`${inst.code}\`) cho hệ thống → +${fmt(out.coins)} ${deps.currencyName()} (giá trị lá thẻ ${fmt(out.value)}, hệ thống mua ${cfg.sellRatePercent}%).` };
      }
      return { text: "Dùng: `card view|inspect|favorite|lock|unlock|upgrade|enhance|evolve|burn|sell <mã thẻ>` · `card search <tên>`" };
    },
  };

  const deck: CommandDef = {
    name: "deck",
    aliases: ["bobai"],
    description: "Bộ bài: deck [create|view|edit|delete|set-active|validate|share|import]",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "view").toLowerCase();
      const cfg = await deps.config();
      const rules = { size: cfg.deckSize, maxCopies: cfg.deckMaxCopies, minSpecies: cfg.deckMinSpecies };
      const myDeck = async (idArg: string) => {
        const id = Number.parseInt(idArg, 10);
        const d = Number.isFinite(id) ? await deps.store.getDeck(id) : null;
        return d && d.userId === ctx.userId ? d : null;
      };
      if (sub === "create") {
        const name = ctx.args.slice(1).join(" ").trim() || "Bộ bài mới";
        const decks = await deps.store.listDecks(ctx.userId);
        const deckPerks = deps.memberPerks
          ? await deps.memberPerks(ctx.userId).catch(() => null)
          : null;
        const maxDecks = cfg.maxDecks + (deckPerks?.extraTeams ?? 0);
        if (decks.length >= maxDecks) return { text: `Bạn đã có tối đa ${maxDecks} bộ bài.` };
        const d = await deps.store.createDeck(ctx.userId, name.slice(0, 60));
        return { text: `Đã tạo bộ bài #${d.id} "${d.name}". Thêm thẻ: \`deck edit ${d.id} add <mã thẻ>\`.` };
      }
      if (sub === "view" && !ctx.args[1]) {
        const decks = await deps.store.listDecks(ctx.userId);
        if (!decks.length) return { text: "Bạn chưa có bộ bài nào. Tạo bằng `deck create <tên>`." };
        return { text: decks.map((d) => `#${d.id} **${d.name}** — ${d.codes.length}/${rules.size} thẻ${d.isActive ? " · Đang dùng" : ""}`).join("\n"), ephemeral: true };
      }
      if (sub === "import") {
        const data = (ctx.args[1] ?? "").trim();
        const codes = data.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
        if (!codes.length) return { text: "Mã bộ bài trống." };
        const valid: string[] = [];
        for (const code of codes) {
          const inst = await ownInstance(ctx.userId, code);
          if (inst) valid.push(inst.code);
        }
        if (valid.length !== codes.length) return { text: "Mã bộ bài chứa thẻ không thuộc về bạn (bộ bài chỉ nhập được bằng thẻ của chính bạn)." };
        const decks = await deps.store.listDecks(ctx.userId);
        const deckPerks2 = deps.memberPerks
          ? await deps.memberPerks(ctx.userId).catch(() => null)
          : null;
        const maxDecks2 = cfg.maxDecks + (deckPerks2?.extraTeams ?? 0);
        if (decks.length >= maxDecks2) return { text: `Bạn đã có tối đa ${maxDecks2} bộ bài.` };
        const d = await deps.store.createDeck(ctx.userId, "Bộ bài nhập");
        await deps.store.setDeckCards(d.id, valid);
        return { text: `Đã nhập bộ bài #${d.id} với ${valid.length} thẻ.` };
      }
      const d = await myDeck(ctx.args[1] ?? "");
      if (!d) return { text: "Không tìm thấy bộ bài đó của bạn. Xem danh sách: `deck view`." };
      if (sub === "view") {
        const map = await speciesMap();
        const names = d.codes.map((c) => c);
        const lines = [`**Bộ bài #${d.id} "${d.name}"** — ${d.codes.length}/${rules.size} thẻ${d.isActive ? " · Đang dùng" : ""}`];
        const insts = await deps.store.listInstances(ctx.userId);
        for (const code of names) {
          const inst = insts.find((i) => i.code === code);
          lines.push(`\`${code}\` ${inst ? `**${map.get(inst.speciesId)?.name ?? inst.speciesId}** Lv.${inst.level}` : "(thẻ không còn trong kho)"}`);
        }
        return { text: lines.join("\n"), ephemeral: true };
      }
      if (sub === "edit") {
        const action = (ctx.args[2] ?? "").toLowerCase();
        const code = (ctx.args[3] ?? "").toUpperCase();
        const inst = await ownInstance(ctx.userId, code);
        if (!inst) return { text: "Không tìm thấy thẻ đó trong kho của bạn." };
        let codes = [...d.codes];
        if (action === "add") {
          if (codes.includes(inst.code)) return { text: "Thẻ đã có trong bộ bài." };
          if (codes.length >= rules.size) return { text: `Bộ bài đã đủ ${rules.size} thẻ.` };
          // Edition split (spec 6.38): one edition per deck — reject
          // adding a card from the other edition.
          if (codes.length) {
            const insts0 = await deps.store.listInstances(ctx.userId);
            const newEdition = speciesEdition(inst.speciesId);
            const clash = codes.some((c) => {
              const other = insts0.find((i) => i.code === c);
              return other && speciesEdition(other.speciesId) !== newEdition;
            });
            if (clash) {
              return { text: "Bộ bài này đang dùng một bản thẻ khác (Anh/Nhật) — hai bản đấu riêng, không trộn vào một bộ được." };
            }
          }
          codes.push(inst.code);
        } else if (action === "remove") {
          codes = codes.filter((c) => c !== inst.code);
        } else {
          return { text: `Dùng: \`deck edit ${d.id} add|remove <mã thẻ>\`` };
        }
        await deps.store.setDeckCards(d.id, codes);
        if (codes.length === rules.size) {
          const insts = await deps.store.listInstances(ctx.userId);
          const speciesIds = codes.map((c) => insts.find((i) => i.code === c)?.speciesId ?? "?");
          if (validateDeck(speciesIds, rules).length === 0) await bump(ctx.userId, "deck_build");
        }
        return { text: `Bộ bài #${d.id} giờ có ${codes.length}/${rules.size} thẻ.` };
      }
      if (sub === "delete") {
        await deps.store.deleteDeck(d.id);
        return { text: `Đã xoá bộ bài #${d.id}.` };
      }
      if (sub === "set-active") {
        await deps.store.setActiveDeck(ctx.userId, d.id);
        return { text: `Đã chọn bộ bài #${d.id} "${d.name}" làm bộ bài sử dụng.` };
      }
      if (sub === "validate") {
        const insts = await deps.store.listInstances(ctx.userId);
        const speciesIds = d.codes.map((c) => insts.find((i) => i.code === c)?.speciesId ?? "?");
        const errors = validateDeck(speciesIds, rules);
        return { text: errors.length ? `Bộ bài chưa hợp lệ:\n${errors.map((e) => `- ${e}`).join("\n")}` : `Bộ bài #${d.id} hợp lệ: ${rules.size} thẻ, đúng luật bản sao và số loài.` };
      }
      if (sub === "share") {
        return { text: `Mã bộ bài #${d.id} (người khác nhập bằng \`deck import <mã>\`, cần có sẵn các thẻ):\n\`${d.codes.join(",")}\``, ephemeral: true };
      }
      return { text: "Dùng: `deck create <tên>` · `deck view [id]` · `deck edit <id> add|remove <mã>` · `deck delete|set-active|validate|share <id>` · `deck import <mã>`" };
    },
  };

  const market: CommandDef = {
    name: "market",
    aliases: ["cho"],
    description: "Chợ thẻ: market [browse|sell|buy|cancel|my-listings]",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "browse").toLowerCase();
      const cfg = await deps.config();
      const map = await speciesMap();
      if (sub === "browse") {
        const rarityFilter = ctx.args[1];
        const open = await deps.store.listOpenListings();
        const rows: string[] = [];
        for (const l of open) {
          const inst = await deps.store.getInstance(l.instanceCode);
          if (!inst) continue;
          const sp = map.get(inst.speciesId);
          if (rarityFilter && (sp?.rarity ?? "").toLowerCase() !== rarityFilter.toLowerCase()) continue;
          rows.push(`#${l.id} — **${sp?.name ?? inst.speciesId}** (${RARITY_TAG[sp?.rarity ?? "Common"]}) Lv.${inst.level} · **${fmt(l.price)}** ${deps.currencyName()} · người bán <@${l.sellerId}>`);
          if (rows.length >= 15) break;
        }
        return { text: rows.length ? `**Chợ thẻ** (mua bằng \`market buy <mã tin>\`)\n${rows.join("\n")}` : "Chợ đang trống — đăng bán bằng `market sell <mã thẻ> <giá>`." };
      }
      if (sub === "sell") {
        const inst = await ownInstance(ctx.userId, ctx.args[1] ?? "");
        const price = Number.parseInt(ctx.args[2] ?? "", 10);
        if (!inst) return { text: "Không tìm thấy thẻ đó trong kho của bạn." };
        if (!Number.isFinite(price) || price < cfg.marketMinPrice) return { text: `Giá bán tối thiểu là ${fmt(cfg.marketMinPrice)} ${deps.currencyName()}.` };
        if (inst.locked || inst.favorite) return { text: "Thẻ đang khoá/yêu thích — không thể đăng bán." };
        if ((await deckCodesOf(ctx.userId)).has(inst.code)) return { text: "Thẻ đang trong bộ bài — gỡ ra trước khi bán." };
        if (await deps.store.listingForInstance(inst.code)) return { text: "Thẻ này đang được đăng bán rồi." };
        const l = await deps.store.createListing(ctx.userId, inst.code, price);
        return { text: `Đã đăng bán **${map.get(inst.speciesId)?.name ?? inst.speciesId}** với giá **${fmt(price)}** ${deps.currencyName()} (tin #${l.id}, phí bán ${cfg.marketFeePercent}%).` };
      }
      if (sub === "buy") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        const l = Number.isFinite(id) ? await deps.store.getListing(id) : null;
        if (!l || l.status !== "open") return { text: "Tin đăng không còn bán." };
        if (l.sellerId === ctx.userId) return { text: "Bạn không thể mua thẻ của chính mình." };
        const ok = await deps.economy.debit(ctx.userId, l.price, "tcg-market", `Mua thẻ tin #${l.id}`);
        if (!ok) return { text: `Không đủ ${deps.currencyName()} để mua (cần ${fmt(l.price)}).` };
        const sellerPerks = deps.memberPerks
          ? await deps.memberPerks(l.sellerId).catch(() => null)
          : null;
        const feePercent = Math.min(
          cfg.marketFeePercent,
          sellerPerks?.marketFeePercent ?? cfg.marketFeePercent,
        );
        const fee = Math.floor((l.price * feePercent) / 100);
        await deps.economy.credit(l.sellerId, l.price - fee, "tcg-market", `Bán thẻ tin #${l.id} (đã trừ phí ${fmt(fee)})`);
        await deps.store.updateInstance(l.instanceCode, { userId: ctx.userId });
        await deps.store.closeListing(l.id, "sold", ctx.userId);
        await bump(ctx.userId, "buy");
        await bump(l.sellerId, "sell");
        const inst = await deps.store.getInstance(l.instanceCode);
        if (inst) {
          const soldSpecies = map.get(inst.speciesId);
          const seed = soldSpecies?.priceUsd
            ? soldSpecies.priceUsd * cfg.priceCoinsPerUsd
            : (BASE_VALUE[(soldSpecies?.rarity ?? "Common") as keyof typeof BASE_VALUE] ?? 0);
          await deps.store.recordMarketSale(inst.speciesId, l.price, seed).catch(() => undefined);
        }
        return { text: `Mua thành công: **${map.get(inst?.speciesId ?? "")?.name ?? "thẻ"}** (\`${l.instanceCode}\`) với giá **${fmt(l.price)}** ${deps.currencyName()}.` };
      }
      if (sub === "cancel") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        const l = Number.isFinite(id) ? await deps.store.getListing(id) : null;
        if (!l || l.sellerId !== ctx.userId || l.status !== "open") return { text: "Không tìm thấy tin đăng đang mở của bạn." };
        await deps.store.closeListing(l.id, "cancelled");
        return { text: `Đã huỷ tin đăng #${l.id}.` };
      }
      if (sub === "my-listings") {
        const mine = await deps.store.listingsOf(ctx.userId);
        if (!mine.length) return { text: "Bạn chưa có tin đăng nào." };
        return {
          text: mine.slice(0, 15).map((l) => `#${l.id} — \`${l.instanceCode}\` · **${fmt(l.price)}** ${deps.currencyName()} · ${l.status === "open" ? "Đang bán" : l.status === "sold" ? "Đã bán" : "Đã huỷ/hết hạn"}`).join("\n"),
          ephemeral: true,
        };
      }
      return { text: "Dùng: `market browse [độ hiếm]` · `market sell <mã thẻ> <giá>` · `market buy <mã tin>` · `market cancel <mã tin>` · `market my-listings`" };
    },
  };

  const trade: CommandDef = {
    name: "trade",
    aliases: ["traodoi"],
    description: "Trao đổi trực tiếp: trade [offer|accept|reject|history]",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "history").toLowerCase();
      if (sub === "offer") {
        const target = ctx.mentions[0];
        if (!target) return { text: "Hãy tag người bạn muốn trao đổi: `trade offer @người <mã thẻ 1,mã thẻ 2> [số Coins]`." };
        if (target === ctx.userId) return { text: "Không thể trao đổi với chính mình." };
        const prefs = await deps.store.getPrefs(target);
        if (prefs.acceptTrades === false) return { text: "Người này đang tắt nhận trao đổi." };
        const codes = (ctx.args[1] ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
        const coins = Number.parseInt(ctx.args[2] ?? "0", 10) || 0;
        if (!codes.length && coins <= 0) return { text: "Đề nghị trống — cần ít nhất 1 thẻ hoặc Coins." };
        const deckCodes = await deckCodesOf(ctx.userId);
        for (const code of codes) {
          const inst = await ownInstance(ctx.userId, code);
          if (!inst) return { text: `Thẻ ${code} không thuộc về bạn.` };
          if (inst.locked || inst.favorite || deckCodes.has(code) || (await deps.store.listingForInstance(code))) {
            return { text: `Thẻ ${code} đang khoá/yêu thích/trong bộ bài/đang bán — không thể mang đi trao đổi.` };
          }
        }
        const t = await deps.store.createTrade(ctx.userId, target, codes, coins);
        return { text: `Đã gửi đề nghị trao đổi #${t.id} tới <@${target}>: ${codes.length} thẻ + ${fmt(coins)} ${deps.currencyName()}. Đối phương dùng \`trade accept ${t.id}\` hoặc \`trade reject ${t.id}\`.` };
      }
      if (sub === "accept" || sub === "reject") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        const t = Number.isFinite(id) ? await deps.store.getTrade(id) : null;
        if (!t || t.status !== "pending") return { text: "Không tìm thấy đề nghị đang chờ." };
        if (sub === "reject") {
          if (t.toUser !== ctx.userId && t.fromUser !== ctx.userId) return { text: "Đề nghị này không liên quan tới bạn." };
          await deps.store.resolveTrade(t.id, "rejected");
          return { text: `Đã từ chối/huỷ đề nghị #${t.id}.` };
        }
        if (t.toUser !== ctx.userId) return { text: "Chỉ người được đề nghị mới chấp nhận được." };
        for (const code of t.offerCodes) {
          const inst = await deps.store.getInstance(code);
          if (!inst || inst.userId !== t.fromUser || inst.locked) {
            return { text: "Đề nghị không còn thực hiện được (thẻ đã đổi chủ hoặc bị khoá)." };
          }
        }
        if (t.offerCoins > 0) {
          const ok = await deps.economy.debit(t.fromUser, t.offerCoins, "tcg-trade", `Trao đổi #${t.id}`);
          if (!ok) return { text: "Người đề nghị không còn đủ Coins cho đề nghị này." };
          await deps.economy.credit(t.toUser, t.offerCoins, "tcg-trade", `Trao đổi #${t.id}`);
        }
        for (const code of t.offerCodes) await deps.store.updateInstance(code, { userId: t.toUser });
        await deps.store.resolveTrade(t.id, "accepted");
        return { text: `Trao đổi #${t.id} hoàn tất: ${t.offerCodes.length} thẻ + ${fmt(t.offerCoins)} ${deps.currencyName()} đã chuyển sang <@${t.toUser}>.` };
      }
      if (sub === "history") {
        const rows = await deps.store.tradeHistory(ctx.userId, 10);
        if (!rows.length) return { text: "Bạn chưa có giao dịch trao đổi nào." };
        return {
          text: rows.map((t) => `#${t.id} — <@${t.fromUser}> → <@${t.toUser}>: ${t.offerCodes.length} thẻ + ${fmt(t.offerCoins)} ${deps.currencyName()} · ${t.status}`).join("\n"),
          ephemeral: true,
        };
      }
      return { text: "Dùng: `trade offer @người <mã thẻ cách nhau dấu phẩy> [Coins]` · `trade accept|reject <mã đề nghị>` · `trade history`" };
    },
  };

  
  const cardbattle: CommandDef = {
    name: "cardbattle",
    aliases: ["cbattle", "dauthe"],
    description: "Battle thẻ bằng bộ bài đang dùng (5 thẻ đầu) với đội đối thủ tự động.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 20,
    handler: async (ctx) => {
      const out = await deps.game.cardBattle(ctx.userId);
      if (out.kind === "error") return { text: out.message };
      const lines = [
        `**Battle thẻ** — Đội của bạn: ${out.teamNames.join(", ")}`,
        `Đối thủ: ${out.enemyNames.join(", ")}`,
        ...out.log,
        out.win
          ? `**Thắng sau ${out.rounds} hiệp!** +${fmt(out.coins)} ${deps.currencyName()} · Đội thẻ +${out.xp} XP`
          : `**Thua sau ${out.rounds} hiệp.** +${fmt(out.coins)} ${deps.currencyName()} · Đội thẻ +${out.xp} XP`,
        ...out.leveledUp.map((s) => `Lên cấp: ${s}`),
      ];
      return { text: lines.join("\n") };
    },
  };

const ranked: CommandDef = {
    name: "ranked",
    aliases: ["dauhang"],
    description: "Đấu hạng TCG: đấu với bộ bài của người chơi khác, cộng/trừ điểm hạng (MMR).",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 20,
    handler: async (ctx) => {
      const out = await deps.game.rankedBattle(ctx.userId);
      if (out.kind === "error") return { text: out.message };
      const lines = [
        `**Đấu hạng TCG** — đối thủ: <@${out.opponentId}>`,
        ...out.log,
        out.win
          ? `**Thắng sau ${out.rounds} hiệp!** +${fmt(out.coins)} ${deps.currencyName()}`
          : `**Thua sau ${out.rounds} hiệp.** +${fmt(out.coins)} ${deps.currencyName()}`,
        `Điểm hạng: **${fmt(out.myMmr)}** (${out.mmrDelta >= 0 ? "+" : ""}${out.mmrDelta}) · Bậc: **${out.tierName}**${out.tierUp ? " — LÊN BẬC!" : ""}`,
      ];
      return { text: lines.join("\n") };
    },
  };

  const rank: CommandDef = {
    name: "rank",
    aliases: ["hang", "mmr"],
    description: "Xem bậc hạng TCG, điểm MMR và thành tích mùa này của bạn.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const prof = await deps.game.rankedProfile(ctx.userId);
      const { rankTierFor, nextTierFor } = await import("../services/tcg-ranked");
      const tier = rankTierFor(prof.mmr);
      const next = nextTierFor(prof.mmr);
      return {
        text:
          `**Hạng TCG của <@${ctx.userId}>**: **${tier.name}** · ${fmt(prof.mmr)} điểm` +
          (next ? ` (còn ${fmt(next.minMmr - prof.mmr)} điểm lên ${next.name})` : "") +
          `\nMùa ${prof.season}: ${prof.seasonWins} thắng · ${prof.seasonLosses} thua` +
          `\nTổng: ${prof.wins} thắng · ${prof.losses} thua`,
        ephemeral: true,
      };
    },
  };

  const duel: CommandDef = {
    name: "duel",
    aliases: ["thachdau"],
    description: "Thách đấu TCG: duel @người [số cược] · duel accept · duel reject.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "").toLowerCase();
      const { duelExpired } = await import("../services/tcg-ranked");
      if (sub === "accept" || sub === "reject") {
        const d = await deps.store.pendingDuelFor(ctx.userId);
        if (!d) return { text: "Bạn không có lời thách đấu nào đang chờ." };
        if (duelExpired(d, now())) {
          await deps.store.resolveDuel(d.id, "expired");
          if (d.wager > 0) await deps.economy.credit(d.challengerId, d.wager, "tcg-duel", "Hoàn cược thách đấu hết hạn");
          return { text: "Lời thách đấu đã hết hạn 5 phút." };
        }
        if (sub === "reject") {
          await deps.store.resolveDuel(d.id, "rejected");
          if (d.wager > 0) await deps.economy.credit(d.challengerId, d.wager, "tcg-duel", "Hoàn cược thách đấu bị từ chối");
          return { text: `Đã từ chối thách đấu của <@${d.challengerId}>.` };
        }
        if (d.wager > 0) {
          const ok = await deps.economy.debit(ctx.userId, d.wager, "tcg-duel", `Nhận cược thách đấu #${d.id}`);
          if (!ok) return { text: `Không đủ ${deps.currencyName()} để nhận cược ${fmt(d.wager)}.` };
        }
        const out = await deps.game.duelBattle(d.challengerId, d.opponentId);
        if (out.kind === "error") {
          await deps.store.resolveDuel(d.id, "rejected");
          if (d.wager > 0) {
            await deps.economy.credit(d.challengerId, d.wager, "tcg-duel", "Hoàn cược thách đấu lỗi");
            await deps.economy.credit(d.opponentId, d.wager, "tcg-duel", "Hoàn cược thách đấu lỗi");
          }
          return { text: out.message };
        }
        await deps.store.resolveDuel(d.id, "done", out.winnerId);
        if (d.wager > 0) {
          await deps.economy.credit(out.winnerId, d.wager * 2, "tcg-duel", `Thắng cược thách đấu #${d.id}`);
        }
        return {
          text: [
            `**Thách đấu TCG #${d.id}** — <@${d.challengerId}> vs <@${d.opponentId}>`,
            ...out.log,
            `**<@${out.winnerId}> thắng sau ${out.rounds} hiệp!**` +
              (d.wager > 0 ? ` Ăn cược **${fmt(d.wager * 2)}** ${deps.currencyName()}.` : ""),
          ].join("\n"),
        };
      }
      const target = ctx.mentions[0];
      if (!target) return { text: "Tag người muốn thách đấu: `duel @người [số cược]` — hoặc `duel accept` / `duel reject`." };
      if (target === ctx.userId) return { text: "Không tự thách đấu chính mình được đâu." };
      const wager = Math.max(0, Number.parseInt(ctx.args.find((a) => /^\d+$/.test(a)) ?? "0", 10) || 0);
      const existing = await deps.store.pendingDuelFor(target);
      if (existing && !duelExpired(existing, now())) {
        return { text: "Người đó đang có một lời thách đấu chờ rồi." };
      }
      if (wager > 0) {
        const ok = await deps.economy.debit(ctx.userId, wager, "tcg-duel", "Đặt cược thách đấu TCG");
        if (!ok) return { text: `Không đủ ${deps.currencyName()} để cược ${fmt(wager)}.` };
      }
      const d = await deps.store.createDuel(ctx.userId, target, wager);
      return {
        text:
          `<@${target}> — <@${ctx.userId}> thách đấu TCG bạn` +
          (wager > 0 ? ` với cược **${fmt(wager)}** ${deps.currencyName()}` : "") +
          `! Trả lời bằng \`duel accept\` hoặc \`duel reject\` trong 5 phút. (Thách đấu #${d.id})`,
      };
    },
  };

  /* ------------ Battle formats (spec 6.38) ------------ */

  const spLine = (map: Map<string, TcgSpecies>, id: string): string => {
    const sp = map.get(id);
    if (!sp) return id;
    return `${sp.name} [${RARITY_TAG[sp.rarity] ?? sp.rarity} · sức mạnh ${fmt(speciesPower(sp))}]`;
  };

  const runScore = (run: FormatRun): string =>
    `Thắng ${run.state.wins}/${CHAIN_WINS} · Thua ${run.state.losses}/2`;

  const challenge: CommandDef = {
    name: "challenge",
    aliases: ["thuthach"],
    description: "Thử thách ngày TCG: đấu đội NPC cố định của hôm nay, thắng nhận 200 Coins + 5 Mảnh (1 lần/ngày).",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 10,
    handler: async (ctx) => {
      const out = await deps.formats.dailyChallenge(ctx.userId);
      if (out.kind === "error") return { text: out.message };
      const lines = [
        `**Thử thách ngày** — Đội của bạn: ${out.teamNames.join(", ")}`,
        `Đối thủ: ${out.enemyNames.join(", ")}`,
        ...out.log,
        out.win
          ? out.rewardClaimed
            ? `**Thắng sau ${out.rounds} hiệp!** +${fmt(out.coins)} ${deps.currencyName()} · +${out.shards} Mảnh thẻ`
            : `**Thắng sau ${out.rounds} hiệp!** Phần thưởng hôm nay đã nhận rồi — mai quay lại nhé.`
          : `**Thua sau ${out.rounds} hiệp.** Đội đối thủ hôm nay cố định — chỉnh lại bộ bài rồi thử lại, miễn phí cả ngày.`,
      ];
      return { text: lines.join("\n") };
    },
  };

  const draftStatusText = async (run: FormatRun): Promise<string> => {
    const map = await speciesMap();
    const st = run.state;
    if (st.phase === "draft") {
      return [
        `**Draft Arena** — vòng chọn ${st.round}/${DRAFT_ROUNDS} · ${runScore(run)}`,
        ...st.offers.map((id, i) => `${i + 1}. ${spLine(map, id)}`),
        "Chọn bằng `draft pick <số>`.",
        st.roster.length
          ? `Đã chọn: ${st.roster.map((id) => map.get(id)?.name ?? id).join(", ")}`
          : "",
      ].filter(Boolean).join("\n");
    }
    if (st.phase === "fight") {
      return [
        `**Draft Arena** — ${runScore(run)}`,
        `Đội ra trận: ${st.field.map((id) => map.get(id)?.name ?? id).join(", ")}`,
        "Đấu trận kế bằng `draft fight`.",
      ].join("\n");
    }
    return `**Draft Arena** — lượt đã kết thúc: ${runScore(run)}. Bắt đầu lượt mới bằng \`draft start\`.`;
  };

  const draft: CommandDef = {
    name: "draft",
    aliases: ["draftarena"],
    description: "Draft Arena: draft [start|pick <số>|fight|status] — chọn 1-trong-3 qua 8 vòng rồi đấu chuỗi 3 trận.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "status").toLowerCase();
      if (sub === "start") {
        const out = await deps.formats.startRun(ctx.userId, "draft");
        if (out.kind === "error") return { text: out.message };
        const head = out.resumed
          ? "Đang có lượt Draft chạy dở — tiếp tục:"
          : out.freeEntry
            ? "Vào Draft Arena — lượt miễn phí hôm nay:"
            : `Vào Draft Arena — đã trừ ${fmt(ENTRY_FEE_COINS)} ${deps.currencyName()} phí lượt:`;
        return { text: `${head}\n${await draftStatusText(out.run)}` };
      }
      if (sub === "pick") {
        const n = Number.parseInt(ctx.args[1] ?? "", 10);
        const out = await deps.formats.draftPick(ctx.userId, n);
        if (out.kind === "error") return { text: out.message };
        return { text: await draftStatusText(out.run) };
      }
      if (sub === "fight") {
        const out = await deps.formats.fightNext(ctx.userId, "draft");
        if (out.kind === "error") return { text: out.message };
        const lines = [
          `**Draft Arena** — Đối thủ: ${out.enemyNames.join(", ")}`,
          ...out.log,
          out.win
            ? `**Thắng trận sau ${out.rounds} hiệp!** +${fmt(out.coins)} ${deps.currencyName()}${out.shards ? ` · +${out.shards} Mảnh thẻ` : ""} · ${runScore(out.run)}`
            : `**Thua trận sau ${out.rounds} hiệp.** ${runScore(out.run)}`,
          out.runDone
            ? "Lượt Draft kết thúc. Chơi tiếp bằng `draft start`."
            : "Đấu tiếp bằng `draft fight`.",
        ];
        return { text: lines.join("\n") };
      }
      const run = await deps.formats.currentRun(ctx.userId, "draft");
      if (!run) {
        return { text: `Chưa có lượt Draft nào. Bắt đầu bằng \`draft start\` (mỗi ngày 1 lượt miễn phí, thêm ${fmt(ENTRY_FEE_COINS)} ${deps.currencyName()}/lượt; thắng trận nhận ${WIN_COINS.join("/")} ${deps.currencyName()}).` };
      }
      return { text: await draftStatusText(run) };
    },
  };

  const sealedStatusText = async (run: FormatRun): Promise<string> => {
    const map = await speciesMap();
    const st = run.state;
    if (st.phase === "done") {
      return `**Sealed** — lượt đã kết thúc: ${runScore(run)}. Bắt đầu lượt mới bằng \`sealed start\`.`;
    }
    return [
      `**Sealed** — ${runScore(run)} · Pool ${st.pool.length} lá`,
      `Đội ra trận: ${st.field.map((id) => map.get(id)?.name ?? id).join(", ")}`,
      "Đấu trận kế bằng `sealed fight`.",
    ].join("\n");
  };

  const sealed: CommandDef = {
    name: "sealed",
    aliases: ["sealeddeck"],
    description: "Sealed: sealed [start|fight|status] — mở pool 30 lá, 5 lá mạnh nhất ra trận đấu chuỗi 3 trận.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "status").toLowerCase();
      if (sub === "start") {
        const out = await deps.formats.startRun(ctx.userId, "sealed");
        if (out.kind === "error") return { text: out.message };
        const map = await speciesMap();
        const poolLines = out.run.state.pool
          .map((id) => map.get(id))
          .filter((s): s is TcgSpecies => Boolean(s))
          .sort((a, b) => speciesPower(b) - speciesPower(a))
          .slice(0, 8)
          .map((s) => spLine(map, s.id));
        const head = out.resumed
          ? "Đang có lượt Sealed chạy dở — tiếp tục:"
          : out.freeEntry
            ? "Mở pool Sealed — lượt miễn phí hôm nay. 8 lá mạnh nhất pool:"
            : `Mở pool Sealed — đã trừ ${fmt(ENTRY_FEE_COINS)} ${deps.currencyName()} phí lượt. 8 lá mạnh nhất pool:`;
        return { text: [head, ...poolLines, await sealedStatusText(out.run)].join("\n") };
      }
      if (sub === "fight") {
        const out = await deps.formats.fightNext(ctx.userId, "sealed");
        if (out.kind === "error") return { text: out.message };
        const lines = [
          `**Sealed** — Đối thủ: ${out.enemyNames.join(", ")}`,
          ...out.log,
          out.win
            ? `**Thắng trận sau ${out.rounds} hiệp!** +${fmt(out.coins)} ${deps.currencyName()}${out.shards ? ` · +${out.shards} Mảnh thẻ` : ""} · ${runScore(out.run)}`
            : `**Thua trận sau ${out.rounds} hiệp.** ${runScore(out.run)}`,
          out.runDone
            ? "Lượt Sealed kết thúc. Chơi tiếp bằng `sealed start`."
            : "Đấu tiếp bằng `sealed fight`.",
        ];
        return { text: lines.join("\n") };
      }
      const run = await deps.formats.currentRun(ctx.userId, "sealed");
      if (!run) {
        return { text: `Chưa có lượt Sealed nào. Bắt đầu bằng \`sealed start\` (mỗi ngày 1 lượt miễn phí, thêm ${fmt(ENTRY_FEE_COINS)} ${deps.currencyName()}/lượt).` };
      }
      return { text: await sealedStatusText(run) };
    },
  };

  const quest: CommandDef = {
    name: "quest",
    aliases: ["nhiemvu"],
    description: "Nhiệm vụ ngày TCG: quest [claim] — 5 nhiệm vụ mỗi ngày, xong hết nhận thêm thưởng hoàn thành.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "view").toLowerCase();
      if (sub === "claim") {
        const view = await deps.quests.view(ctx.userId);
        const ready = view.rows.filter((r) => r.done && !r.claimed);
        if (!ready.length) return { text: "Chưa có nhiệm vụ nào xong để nhận thưởng — xem danh sách bằng `quest`." };
        const lines: string[] = [];
        let totalCoins = 0;
        let totalShards = 0;
        for (const r of ready) {
          const out = await deps.quests.claim(ctx.userId, r.id);
          if (out.kind !== "ok") continue;
          totalCoins += out.coins + out.bonusCoins;
          totalShards += out.shards + out.bonusShards;
          lines.push(
            `Đã nhận: **${r.name}**` +
              (out.coins ? ` +${fmt(out.coins)} ${deps.currencyName()}` : "") +
              (out.shards ? ` +${out.shards} Mảnh thẻ` : "") +
              (out.bonusCoins || out.bonusShards
                ? ` · Thưởng hoàn thành cả 5: +${fmt(out.bonusCoins)} ${deps.currencyName()} · +${out.bonusShards} Mảnh thẻ`
                : ""),
          );
        }
        if (!lines.length) return { text: "Chưa có nhiệm vụ nào xong để nhận thưởng — xem danh sách bằng `quest`." };
        lines.push(`Tổng nhận: **${fmt(totalCoins)}** ${deps.currencyName()} · **${totalShards}** Mảnh thẻ`);
        return { text: lines.join("\n") };
      }
      const view = await deps.quests.view(ctx.userId);
      const lines = [
        `**Nhiệm vụ ngày TCG** (${view.day}) — xong cả 5 nhận thêm **${fmt(QUEST_BONUS_COINS)}** ${deps.currencyName()} + **${QUEST_BONUS_SHARDS}** Mảnh thẻ${view.bonusClaimed ? " (đã nhận thưởng hoàn thành)" : ""}:`,
        ...view.rows.map((r) =>
          r.claimed
            ? `[x] ~~${r.name}~~ — đã nhận`
            : `${r.done ? "[v]" : "[ ]"} ${r.name} — ${r.progress}/${r.target}` +
              (r.done ? " · xong, nhận bằng `quest claim`" : "") +
              (r.coins ? ` · thưởng ${fmt(r.coins)} ${deps.currencyName()}` : "") +
              (r.shards ? ` · thưởng ${r.shards} Mảnh thẻ` : ""),
        ),
      ];
      return { text: lines.join("\n"), ephemeral: true };
    },
  };

  const timeLeft = (endsAt: Date) => {
    const ms = endsAt.getTime() - Date.now();
    if (ms <= 0) return "đã hết giờ";
    const mins = Math.floor(ms / 60000);
    if (mins >= 60) return `còn ${Math.floor(mins / 60)}g${String(mins % 60).padStart(2, "0")}p`;
    return `còn ${mins}p`;
  };

  const showcase: CommandDef = {
    name: "showcase",
    aliases: ["trungbay"],
    description: "Xem trang trưng bày thẻ của mình hoặc người khác: showcase [@người dùng].",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const target = ctx.mentions[0] ?? ctx.userId;
      const view = await deps.social.showcaseView(ctx.userId, target);
      if (view.state === "none") {
        return {
          text: target === ctx.userId
            ? "Bạn chưa mở trang trưng bày — mở trang và ghim thẻ trên web, mục Trưng Bày."
            : "Người đó chưa mở trang trưng bày.",
          ephemeral: true,
        };
      }
      if (view.state === "private") return { text: "Trang trưng bày này đang để riêng tư.", ephemeral: true };
      const lines = [
        `**Trang trưng bày** của <@${target}> — nền ${view.theme} · bố cục ${view.layout} · hiệu ứng ${view.effect}`,
        ...(view.cards.length
          ? view.cards.map((c, i) => `${i + 1}. ${RARITY_TAG[c.rarity]} **${c.name}** — Lv.${c.level}${c.enhance ? ` +${c.enhance}` : ""} · \`${c.code}\``)
          : ["Chưa ghim thẻ nào."]),
      ];
      return { text: lines.join("\n") };
    },
  };

  const auction: CommandDef = {
    name: "auction",
    aliases: ["daugia", "dg"],
    description: "Đấu giá thẻ của người chơi: auction bid/buynow/create/cancel/my, tiền trả giá được ký quỹ.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "list").toLowerCase();
      const coin = deps.currencyName();
      if (sub === "list") {
        const rows = await deps.social.listAuctions();
        if (!rows.length) return { text: "Chưa có phiên đấu giá nào đang mở. Tạo phiên bằng `auction create <mã thẻ> <giá khởi điểm> <giờ>`." };
        const lines = rows.map((a) =>
          `#${a.id} ${RARITY_TAG[a.rarity]} **${a.name}** Lv.${a.level}${a.enhance ? ` +${a.enhance}` : ""} — ` +
          (a.currentPrice != null ? `giá **${fmt(a.currentPrice)}** ${coin}` : `khởi điểm **${fmt(a.startPrice)}** ${coin}`) +
          ` · ${a.bids} lượt trả · ${timeLeft(a.endsAt)}` +
          (a.buyNowPrice != null ? ` · mua ngay ${fmt(a.buyNowPrice)}` : "") +
          ` · của <@${a.sellerId}>`);
        return { text: `**Đấu giá đang mở** (trả giá: \`auction bid <phiên> <giá>\`):\n${lines.join("\n")}` };
      }
      if (sub === "bid") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        const amount = Number.parseFloat(ctx.args[2] ?? "");
        if (!Number.isFinite(id) || !Number.isFinite(amount)) return { text: "Cú pháp: `auction bid <phiên> <giá>`." };
        const out = await deps.social.placeBid(ctx.userId, id, amount);
        return { text: out.ok ? `Đã trả **${fmt(amount)}** ${coin} cho phiên #${id} — bạn đang giữ giá cao nhất.` : out.error };
      }
      if (sub === "buynow") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        if (!Number.isFinite(id)) return { text: "Cú pháp: `auction buynow <phiên>`." };
        const out = await deps.social.buyNow(ctx.userId, id);
        return { text: out.ok ? `Đã mua ngay thành công phiên #${id} — thẻ đã về kho của bạn.` : out.error };
      }
      if (sub === "create") {
        const code = ctx.args[1] ?? "";
        const start = Number.parseFloat(ctx.args[2] ?? "");
        const hours = Number.parseInt(ctx.args[3] ?? "", 10);
        const buyNow = ctx.args[4] ? Number.parseFloat(ctx.args[4]) : null;
        if (!code || !Number.isFinite(start) || !Number.isFinite(hours)) {
          return { text: "Cú pháp: `auction create <mã thẻ> <giá khởi điểm> <giờ: 1|6|24|72> [giá mua ngay]`." };
        }
        const out = await deps.social.createAuction(ctx.userId, code, start, hours, buyNow);
        return { text: out.ok ? `Đã tạo phiên đấu giá **#${out.id}** (${hours} giờ).` : out.error };
      }
      if (sub === "cancel") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        if (!Number.isFinite(id)) return { text: "Cú pháp: `auction cancel <phiên>`." };
        const out = await deps.social.cancelAuction(ctx.userId, id);
        return { text: out.ok ? `Đã huỷ phiên #${id}.` : out.error };
      }
      if (sub === "my") {
        const mine = await deps.social.myAuctions(ctx.userId);
        const fmtRow = (a: (typeof mine.selling)[number]) =>
          `#${a.id} **${a.name}** — ${a.status === "open" ? (a.currentPrice != null ? `${fmt(a.currentPrice)} ${coin}` : `khởi điểm ${fmt(a.startPrice)} ${coin}`) : a.status} · ${a.bids} lượt trả`;
        const lines = [
          "**Phiên của bạn:**",
          ...(mine.selling.length ? mine.selling.map(fmtRow) : ["(chưa có)"]),
          "**Phiên bạn đang trả giá:**",
          ...(mine.bidding.length ? mine.bidding.map(fmtRow) : ["(chưa có)"]),
        ];
        return { text: lines.join("\n"), ephemeral: true };
      }
      return { text: "Cú pháp: `auction [list|bid|buynow|create|cancel|my]`." };
    },
  };

  const tournament: CommandDef = {
    name: "tournament",
    aliases: ["giaidau", "giai"],
    description: "Giải đấu thẻ 8/16 người: tournament join/play/my/detail/create, đấu bằng bộ bài đã đăng ký.",
    module: "cozy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 5,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "list").toLowerCase();
      const coin = deps.currencyName();
      if (sub === "list") {
        const rows = await deps.social.listTournaments(ctx.userId);
        if (!rows.length) return { text: "Chưa có giải đấu nào. Tạo giải bằng `tournament create <8|16> <phí> <tên giải>`." };
        const lines = rows.map((t) =>
          `#${t.id} **${t.name}** — ${t.entrants}/${t.size} người · phí ${fmt(t.entryFee)} ${coin} · ${
            t.status === "open" ? "đang mở đăng ký" : t.status === "running" ? "đang đấu" : t.status === "done" ? `xong, vô địch <@${t.championId}>` : t.status
          }${t.edition ? ` · bản ${t.edition === "jp" ? "Nhật" : "tiếng Anh"}` : ""}${t.joined ? " · bạn đã đăng ký" : ""}`);
        return { text: `**Giải đấu** (đăng ký: \`tournament join <giải>\`):\n${lines.join("\n")}` };
      }
      if (sub === "join") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        if (!Number.isFinite(id)) return { text: "Cú pháp: `tournament join <giải>`." };
        const out = await deps.social.joinTournament(ctx.userId, id);
        return { text: out.ok ? `Đã đăng ký giải #${id} bằng bộ bài đang dùng — đủ người là giải tự bắt đầu.` : out.error };
      }
      if (sub === "play") {
        let matchId = Number.parseInt(ctx.args[1] ?? "", 10);
        if (!Number.isFinite(matchId)) {
          const mine = await deps.social.myMatches(ctx.userId);
          if (!mine.length) return { text: "Bạn không có trận nào đang chờ đấu." };
          matchId = mine[0].id;
        }
        const out = await deps.social.playMatch(ctx.userId, matchId);
        if (!out.ok) return { text: out.error };
        if (!out.winnerId) return { text: `Đã điểm danh trận #${matchId} — chờ đối thủ điểm danh là trận tự đánh.` };
        const tail = (out.log ?? []).slice(-6).join("\n");
        return {
          text: `**Trận #${matchId} có kết quả:** <@${out.winnerId}> thắng!\n${tail ? `\`\`\`\n${tail}\n\`\`\`` : ""}`,
        };
      }
      if (sub === "my") {
        const mine = await deps.social.myMatches(ctx.userId);
        if (!mine.length) return { text: "Bạn không có trận nào đang chờ đấu.", ephemeral: true };
        const lines = mine.map((m) =>
          `Trận #${m.id} — **${m.tournamentName}** · ${m.roundLabel} · gặp <@${m.p1Id === ctx.userId ? m.p2Id : m.p1Id}> · điểm danh bằng \`tournament play ${m.id}\``);
        return { text: lines.join("\n"), ephemeral: true };
      }
      if (sub === "detail") {
        const id = Number.parseInt(ctx.args[1] ?? "", 10);
        if (!Number.isFinite(id)) return { text: "Cú pháp: `tournament detail <giải>`." };
        const detail = await deps.social.tournamentDetail(id);
        if (!detail) return { text: "Không tìm thấy giải đấu đó." };
        const nameOf = (uid: string | null) => (uid ? `<@${uid}>` : "—");
        const lines = [
          `**${detail.t.name}** (#${detail.t.id}) — ${detail.entries.length}/${detail.t.size} người · phí ${fmt(detail.t.entryFee)} ${coin} · trạng thái ${detail.t.status}`,
          ...detail.matches.map((m) =>
            `${socialRoundName(m.round, detail.t.size)}: ${nameOf(m.p1Id)} vs ${nameOf(m.p2Id)}${m.winnerId ? ` → **${nameOf(m.winnerId)}** thắng` : ""}`),
        ];
        return { text: lines.join("\n") };
      }
      if (sub === "create") {
        const size = Number.parseInt(ctx.args[1] ?? "", 10);
        const fee = Number.parseFloat(ctx.args[2] ?? "");
        const name = ctx.args.slice(3).join(" ");
        if (!Number.isFinite(size) || !Number.isFinite(fee) || !name) {
          return { text: "Cú pháp: `tournament create <8|16> <phí> <tên giải>`." };
        }
        const out = await deps.social.createTournament(ctx.userId, name, size, fee);
        return { text: out.ok ? `Đã tạo giải **#${out.id}** — đăng ký bằng \`tournament join ${out.id}\`.` : out.error };
      }
      return { text: "Cú pháp: `tournament [list|join|play|my|detail|create]`." };
    },
  };

return [gacha, card, deck, market, trade, cardbattle, ranked, rank, duel, challenge, draft, sealed, quest, showcase, auction, tournament];
}
