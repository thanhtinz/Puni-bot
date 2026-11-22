/**
 * Discord client wiring: translates Discord events into dispatcher
 * calls and dispatcher outcomes back into Discord replies. All
 * command logic lives behind the dispatcher — this file only adapts
 * transports.
 *
 * Puni is a pure game bot (spec 6.28): TCG + economy + marriage.
 * There is NO server-management surface here — no moderation, no
 * automod, no logging, no greetings, no AI chat.
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
import type { CommandRegistry } from "@puni/shared";
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
    if (msg.author.bot || !msg.guild) return;
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
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction as ChatInputCommandInteraction;
    const args: string[] = [];
    const mentions: string[] = [];
    if (cmd.commandName === "pay") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
      const amount = cmd.options.getInteger("sotien");
      if (amount != null) args.push(String(amount));
    } else if (cmd.commandName === "balance") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
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
