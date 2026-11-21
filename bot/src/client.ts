/**
 * Discord client wiring: translates Discord events into dispatcher calls
 * and dispatcher outcomes back into Discord replies. All command logic
 * lives behind the dispatcher — this file only adapts transports.
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
import { Dispatcher, type DispatchOutcome } from "./dispatcher";
import { rankFromMember } from "./permissions";
import type { GuildSettingsProvider } from "./guild-settings";
import type { BotConfig } from "./config";

/** Build the global slash payload from the registry. Guild-gated modules
 *  (shop) are NOT registered globally — they are registered per guild when
 *  the module is enabled there (hidden-shop law, spec 6.15). */
export function buildSlashPayload(registry: CommandRegistry) {
  return registry
    .slashCommands()
    .filter((c) => c.module !== "shop")
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
}): Client {
  const { config, registry, settings } = deps;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  const dispatcher = new Dispatcher(
    registry,
    settings,
    // Fallback resolver: events carry a precomputed rank from the caller's
    // Discord member permissions (permissions.ts), so this only runs when
    // a caller did not provide one.
    async () => 0,
    config.ownerDiscordId,
    { cooldownStore: deps.cooldownStore },
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
    const outcome = await dispatcher.dispatchPrefix({
      content: msg.content,
      userId: msg.author.id,
      guildId: msg.guild.id,
      channelId: msg.channelId,
      rank: rankFromMember({
        isGuildOwner: msg.guild.ownerId === msg.author.id,
        permissions: msg.member?.permissions.bitfield ?? 0n,
      }),
    });
    if (outcome.kind === "ok") {
      const embed = outcomeEmbed(outcome);
      await msg.reply(
        embed ? { embeds: [embed], allowedMentions: { repliedUser: false } } : { content: outcome.result.text },
      );
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
