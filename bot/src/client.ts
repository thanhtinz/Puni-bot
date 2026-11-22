/**
 * Discord client wiring: translates Discord events into dispatcher
 * calls and dispatcher outcomes back into Discord replies. All
 * command logic lives behind the dispatcher — this file only adapts
 * transports.
 *
 * Scope (owner correction 2026-11-21 23:59): only SERVER-MANAGEMENT
 * features were removed (moderation, automod, logging, greetings,
 * verify, branding). The game and fun surface stays: TCG, economy,
 * marriage, reactions, vote and AI chat.
 */
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import { REACTIONS, type CommandRegistry } from "@puni/shared";
import {
  AiChatService,
  pickEmptyMentionReply,
  shouldTriggerAiChat,
  stripBotMention,
} from "./services/ai-chat";
import { Dispatcher, type DispatchOutcome } from "./dispatcher";
import { rankFromMember } from "./permissions";
import type { GuildSettingsProvider } from "./guild-settings";
import type { BotConfig } from "./config";

/** Build the global slash payload from the registry. */
export function buildSlashPayload(registry: CommandRegistry) {
  return registry
    .slashCommands()
    .map((c) => {
      const b = new SlashCommandBuilder().setName(c.name).setDescription(c.description);
      if (c.name === "reaction") {
        b.addStringOption((o) =>
          o.setName("ten").setDescription("Tên reaction").setRequired(true).setAutocomplete(true),
        );
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người muốn tag").setRequired(false));
      }
      if (c.name === "pay") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người nhận").setRequired(true));
        b.addIntegerOption((o) =>
          o.setName("sotien").setDescription("Số tiền").setRequired(true).setMinValue(1),
        );
      }
      if (c.name === "balance") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Xem số dư của ai").setRequired(false));
      }
      if (["gacha", "card", "deck", "market", "trade", "settings", "collection"].includes(c.name)) {
        b.addStringOption((o) => o.setName("hanhdong").setDescription("Hành động: single/multi/view/sell/offer...").setRequired(false));
        b.addStringOption((o) => o.setName("thamso").setDescription("Tham số: mã thẻ, giá, tên bộ bài...").setRequired(false));
      }
      if (c.name === "trade") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người nhận trao đổi (cho offer)").setRequired(false));
      }
      if (c.name === "coinflip") {
        b.addStringOption((o) => o.setName("phia").setDescription("sap / ngua (đấu bot) hoặc accept / reject").setRequired(false));
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người muốn thách đấu").setRequired(false));
        b.addIntegerOption((o) => o.setName("cuoc").setDescription("Số Coins cược (tối thiểu 10)").setRequired(false).setMinValue(10));
      }
      if (c.name === "blackjack") {
        b.addStringOption((o) => o.setName("hanhdong").setDescription("hit (rút) / stand (dừng)").setRequired(false));
        b.addIntegerOption((o) => o.setName("cuoc").setDescription("Số Coins cược để bắt đầu ván (tối thiểu 10)").setRequired(false).setMinValue(10));
      }
      if (c.name === "tictactoe") {
        b.addIntegerOption((o) => o.setName("o").setDescription("Ô muốn đánh (1-9)").setRequired(false).setMinValue(1).setMaxValue(9));
        b.addStringOption((o) => o.setName("muc").setDescription("Độ khó khi đấu bot: easy / medium / hard").setRequired(false));
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người muốn thách đấu").setRequired(false));
        b.addIntegerOption((o) => o.setName("cuoc").setDescription("Số Coins cược khi thách đấu").setRequired(false).setMinValue(10));
      }
      if (c.name === "race") {
        b.addStringOption((o) =>
          o.setName("con").setDescription("Con vật muốn cược").setRequired(true)
            .addChoices(
              { name: "Ngựa ×1.9", value: "ngua" },
              { name: "Thỏ ×2.2", value: "tho" },
              { name: "Chó ×2.4", value: "cho" },
              { name: "Mèo ×2.8", value: "meo" },
              { name: "Rùa ×4.5", value: "rua" },
            ));
        b.addIntegerOption((o) => o.setName("cuoc").setDescription("Số Coins cược (tối thiểu 10)").setRequired(true).setMinValue(10));
      }
      if (c.name === "demso" || c.name === "noichu") {
        b.addStringOption((o) => o.setName("hanhdong").setDescription("set (bật) / off (tắt) — trống = xem trạng thái").setRequired(false));
      }
      if (c.name === "duel") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người muốn thách đấu").setRequired(false));
        b.addStringOption((o) => o.setName("hanhdong").setDescription("accept / reject, hoặc số tiền cược khi thách đấu").setRequired(false));
      }
      if (c.name === "marry") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người muốn cầu hôn").setRequired(false));
        b.addStringOption((o) => o.setName("hanhdong").setDescription("buy <bậc nhẫn> / accept / reject / divorce / status").setRequired(false));
      }
      return b.toJSON();
    });
}

function outcomeEmbed(outcome: Extract<DispatchOutcome, { kind: "ok" }>) {
  const { result } = outcome;
  if (result.imageUrl) {
    return new EmbedBuilder().setDescription(result.text).setImage(result.imageUrl);
  }
  return null;
}

export function createBotClient(deps: {
  config: BotConfig;
  registry: CommandRegistry;
  settings: GuildSettingsProvider;
  cooldownStore?: import("./dispatcher").CooldownStore;
  /** AI chat (@mention replies). Absent = provider not configured = off. */
  aiChat?: AiChatService;
  /** Channel games (counting / word chain) message hook. */
  channelGames?: import("./services/channel-games").ChannelGamesService;
  /** Owner master switch for AI chat (Admin panel); absent = enabled. */
  aiGloballyEnabled?: () => Promise<boolean>;
  /** Owner global bot on/off switch (Admin panel → Vận hành). */
  botGate?: () => Promise<{ off: boolean; message: string }>;
}): Client {
  const { config, registry, settings } = deps;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const dispatcher = new Dispatcher(
    registry,
    settings,
    // Fallback resolver: events carry a precomputed rank from the
    // caller's Discord member permissions (permissions.ts), so this
    // only runs when a caller did not provide one.
    async () => 0,
    config.ownerDiscordId,
    { cooldownStore: deps.cooldownStore, botGate: deps.botGate },
  );

  client.once(Events.ClientReady, async (c) => {
    console.log(
      `[puni] ready as ${c.user.tag} shard=${c.shard?.ids.join(",") ?? "-"} guilds=${c.guilds.cache.size}`,
    );
    if (process.env.REGISTER_SLASH === "1" && config.token) {
      const rest = new REST({ version: "10" }).setToken(config.token);
      await rest.put(Routes.applicationCommands(c.user.id), {
        body: buildSlashPayload(registry),
      });
      console.log("[puni] slash commands registered globally");
    }
  });

  client.on(Events.MessageCreate, async (msg: Message) => {
    if (msg.author.bot) return;
    if (!msg.guild) {
      // DMs: only commands that explicitly opt in (werewolf night
      // actions) are dispatched — the dispatcher enforces the flag.
      const outcome = await dispatcher.dispatchPrefix({
        content: msg.content,
        userId: msg.author.id,
        guildId: null,
        channelId: msg.channelId,
      });
      if (outcome.kind === "ok") {
        await msg.reply({ content: outcome.result.text }).catch(() => undefined);
      } else if (outcome.kind === "cooldown") {
        await msg.reply(`⏳ Chờ ${outcome.secondsLeft}s nữa nhé!`).catch(() => undefined);
      } else if (outcome.kind === "forbidden") {
        await msg.reply("Bạn không có quyền dùng lệnh này.").catch(() => undefined);
      } else if (outcome.kind === "maintenance") {
        await msg.reply(outcome.message).catch(() => undefined);
      } else if (outcome.kind === "error") {
        console.error("[puni] DM command error", outcome.error);
        await msg.reply("Đã có lỗi xảy ra, thử lại sau nhé!").catch(() => undefined);
      }
      return;
    }

    // Channel games: plain (non-command) messages in a counting /
    // word-chain channel are validated by the game.
    if (deps.channelGames) {
      const gs = await settings.get(msg.guild.id).catch(() => null);
      const isCommand = gs ? msg.content.trimStart().startsWith(gs.prefix) : false;
      if (!isCommand && !msg.mentions.has(client.user?.id ?? "")) {
        const outcome = await deps.channelGames
          .handleMessage({
            guildId: msg.guild.id,
            channelId: msg.channelId,
            userId: msg.author.id,
            content: msg.content,
          })
          .catch(() => null);
        if (outcome && outcome.action !== "ignore") {
          if (outcome.react) await msg.react(outcome.react).catch(() => undefined);
          if (outcome.action === "wrong") {
            await msg.reply({ content: outcome.reply, allowedMentions: { repliedUser: false } }).catch(() => undefined);
          }
          return;
        }
      }
    }

    // AI chat: a @mention that is not a command gets a cute cat reply.
    if (deps.aiChat && client.user && msg.mentions.has(client.user.id)) {
      const guildSettings = await settings.get(msg.guild.id);
      const globalEnabled = deps.aiGloballyEnabled
        ? await deps.aiGloballyEnabled().catch(() => true)
        : true;
      if (
        shouldTriggerAiChat({
          mentionsBot: true,
          isCommand: msg.content.trimStart().startsWith(guildSettings.prefix),
          guildEnabled: guildSettings.aiChat.enabled,
          providerConfigured: true,
          globalEnabled,
        })
      ) {
        const text = stripBotMention(msg.content, client.user.id);
        if (!text) {
          await msg.reply({
            content: pickEmptyMentionReply(msg.author.id),
            allowedMentions: { repliedUser: false },
          });
          return;
        }
        const typing = setInterval(() => {
          if ("sendTyping" in msg.channel) {
            (msg.channel as { sendTyping: () => Promise<unknown> }).sendTyping().catch(() => undefined);
          }
        }, 8_000);
        if ("sendTyping" in msg.channel) {
          (msg.channel as { sendTyping: () => Promise<unknown> }).sendTyping().catch(() => undefined);
        }
        try {
          const outcome = await deps.aiChat.ask({
            guildId: msg.guild.id,
            guildName: msg.guild.name,
            userId: msg.author.id,
            text,
          });
          if (outcome.kind === "reply") {
            await msg.reply({ content: outcome.text, allowedMentions: { repliedUser: false } });
          } else if (outcome.kind === "error") {
            await msg.reply({
              content: "Meo... Puni đang rối trí một chút, hỏi lại sau nhé meo meo ~",
              allowedMentions: { repliedUser: false },
            });
          }
          // cooldown: stay silent — a cat does not spam.
        } finally {
          clearInterval(typing);
        }
        return;
      }
    }

    const rank = rankFromMember({
      isGuildOwner: msg.guild.ownerId === msg.author.id,
      permissions: msg.member?.permissions.bitfield ?? 0n,
    });
    const outcome = await dispatcher.dispatchPrefix({
      content: msg.content,
      userId: msg.author.id,
      guildId: msg.guild.id,
      channelId: msg.channelId,
      rank,
    });
    if (outcome.kind === "ok") {
      const embed = outcomeEmbed(outcome);
      await msg.reply(
        embed ? { embeds: [embed], allowedMentions: { repliedUser: false } } : { content: outcome.result.text },
      );
    } else if (outcome.kind === "maintenance") {
      await msg.reply(outcome.message);
    } else if (outcome.kind === "cooldown") {
      const notice = await msg.reply(`⏳ Chờ ${outcome.secondsLeft}s nữa nhé!`);
      setTimeout(() => notice.delete().catch(() => undefined), 5000);
    } else if (outcome.kind === "forbidden") {
      await msg.reply("Bạn không có quyền dùng lệnh này.");
    } else if (outcome.kind === "error") {
      console.error("[puni] command error", outcome.error);
      await msg.reply("Đã có lỗi xảy ra, thử lại sau nhé!");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "reaction") {
        const focused = interaction.options.getFocused().toLowerCase();
        const choices = REACTIONS.filter((r) => r.name.startsWith(focused))
          .slice(0, 25)
          .map((r) => ({ name: r.name, value: r.name }));
        await interaction.respond(choices).catch(() => undefined);
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction as ChatInputCommandInteraction;
    const args: string[] = [];
    const mentions: string[] = [];
    if (cmd.commandName === "reaction") {
      args.push(cmd.options.getString("ten") ?? "");
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
    } else if (cmd.commandName === "pay") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
      const amount = cmd.options.getInteger("sotien");
      if (amount != null) args.push(String(amount));
    } else if (cmd.commandName === "balance") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
    }
    if (cmd.commandName === "coinflip") {
      const phia = cmd.options.getString("phia");
      if (phia) args.push(phia);
      const bet = cmd.options.getInteger("cuoc");
      if (bet) args.push(String(bet));
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
    } else if (cmd.commandName === "blackjack") {
      const action = cmd.options.getString("hanhdong");
      const bet = cmd.options.getInteger("cuoc");
      if (action) args.push(action);
      else if (bet) args.push(String(bet));
    } else if (cmd.commandName === "tictactoe") {
      const cell = cmd.options.getInteger("o");
      const level = cmd.options.getString("muc");
      const bet = cmd.options.getInteger("cuoc");
      const user = cmd.options.getUser("nguoi");
      if (cell) args.push(String(cell));
      else if (level) args.push(level);
      if (bet) args.push(String(bet));
      if (user) mentions.push(user.id);
    } else if (cmd.commandName === "race") {
      args.push(cmd.options.getString("con") ?? "");
      const bet = cmd.options.getInteger("cuoc");
      if (bet) args.push(String(bet));
    } else if (cmd.commandName === "demso" || cmd.commandName === "noichu") {
      const action = cmd.options.getString("hanhdong");
      if (action) args.push(action);
    } else if (cmd.commandName === "duel" || cmd.commandName === "marry") {
      const action = cmd.options.getString("hanhdong");
      if (action) args.push(...action.split(/\s+/).filter(Boolean));
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
    } else if (["gacha", "card", "deck", "market", "trade", "settings", "collection"].includes(cmd.commandName)) {
      const action = cmd.options.getString("hanhdong");
      if (action) args.push(action);
      const rest = cmd.options.getString("thamso");
      if (rest) args.push(...rest.split(/\s+/).filter(Boolean));
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
    }
    const outcome = await dispatcher.dispatchSlash({
      name: cmd.commandName,
      userId: cmd.user.id,
      guildId: cmd.guildId,
      channelId: cmd.channelId,
      args,
      mentions,
      rank: cmd.guildId
        ? rankFromMember({
            isGuildOwner: cmd.guild?.ownerId === cmd.user.id,
            permissions: cmd.memberPermissions?.bitfield ?? 0n,
          })
        : 0,
    });
    if (outcome.kind === "ok") {
      const embed = outcomeEmbed(outcome);
      await cmd.reply({
        ...(embed ? { embeds: [embed] } : { content: outcome.result.text }),
        ephemeral: outcome.result.ephemeral ?? false,
      });
    } else if (outcome.kind === "maintenance") {
      await cmd.reply({ content: outcome.message, ephemeral: true });
    } else if (outcome.kind === "cooldown") {
      await cmd.reply({ content: `⏳ Chờ ${outcome.secondsLeft}s nữa nhé!`, ephemeral: true });
    } else if (outcome.kind === "forbidden") {
      await cmd.reply({ content: "Bạn không có quyền dùng lệnh này.", ephemeral: true });
    } else if (outcome.kind === "error") {
      console.error("[puni] command error", outcome.error);
      await cmd.reply({ content: "Đã có lỗi xảy ra, thử lại sau nhé!", ephemeral: true });
    }
  });

  return client;
}
