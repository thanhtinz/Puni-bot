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
  MessageType,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import { REACTIONS, type CommandRegistry } from "@puni/shared";
import { Dispatcher, type DispatchOutcome } from "./dispatcher";
import { rankFromMember } from "./permissions";
import { CommunityEvents, type ChannelSender } from "./services/community";
import { LogService } from "./services/logging";
import { checkAutomod } from "./services/automod";
import type { CaseHook, ModCaseStore } from "./services/mod-cases";
import type { Enforcer, LateBindingEnforcer } from "./services/enforcement";
import type { GuildSettingsProvider } from "./guild-settings";
import {
  AiChatService,
  pickEmptyMentionReply,
  shouldTriggerAiChat,
  stripBotMention,
} from "./services/ai-chat";
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
      if (c.name === "warn") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người bị cảnh cáo").setRequired(true));
        b.addStringOption((o) => o.setName("lydo").setDescription("Lý do").setRequired(false));
      }
      if (c.name === "case") {
        b.addIntegerOption((o) => o.setName("so").setDescription("Số case").setRequired(true).setMinValue(1));
      }
      if (c.name === "cases") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người cần xem").setRequired(true));
      }
      if (c.name === "mute") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người bị mute").setRequired(true));
        b.addStringOption((o) => o.setName("thoiluong").setDescription("Thời lượng: 30s/10m/2h/1d").setRequired(true));
        b.addStringOption((o) => o.setName("lydo").setDescription("Lý do").setRequired(false));
      }
      if (c.name === "unmute" || c.name === "kick" || c.name === "ban") {
        b.addUserOption((o) => o.setName("nguoi").setDescription("Người bị xử lý").setRequired(true));
        b.addStringOption((o) => o.setName("lydo").setDescription("Lý do").setRequired(false));
      }
      if (c.name === "unban") {
        b.addStringOption((o) => o.setName("userid").setDescription("User ID cần gỡ ban").setRequired(true));
        b.addStringOption((o) => o.setName("lydo").setDescription("Lý do").setRequired(false));
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
  enforcer?: LateBindingEnforcer;
  cases?: ModCaseStore;
  addCaseHook?: (hook: CaseHook) => void;
  /** AI chat (@mention replies). Absent = provider not configured = off. */
  aiChat?: AiChatService;
  /** Owner master switch for AI chat (Admin panel); absent = enabled. */
  aiGloballyEnabled?: () => Promise<boolean>;
  /** Owner global bot on/off switch (Admin panel → Vận hành). */
  botGate?: () => Promise<{ off: boolean; message: string }>;
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
    { cooldownStore: deps.cooldownStore, botGate: deps.botGate },
  );

  const sender: ChannelSender = {
    send: async (channelId, text) => {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased() && "send" in channel) {
        await (channel as { send: (t: string) => Promise<unknown> }).send(text);
      }
    },
  };
  const logService = new LogService(settings, sender);

  if (deps.addCaseHook) {
    deps.addCaseHook(async (c) => {
      await logService.log(
        c.guildId,
        "moderation",
        `**Case #${c.caseNo}** — ${c.action} • <@${c.targetId}> • bởi <@${c.moderatorId}>${c.reason ? ` • Lý do: ${c.reason}` : ""}`,
      );
    });
  }

  if (deps.enforcer) {
    const backend: Enforcer = {
      async timeout(guildId, userId, durationSec, reason) {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        await member.timeout(durationSec * 1000, reason || undefined);
      },
      async removeTimeout(guildId, userId, reason) {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        await member.timeout(null, reason || undefined);
      },
      async kick(guildId, userId, reason) {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        await member.kick(reason || undefined);
      },
      async ban(guildId, userId, reason) {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.ban(userId, { reason: reason || undefined });
      },
      async unban(guildId, userId, reason) {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.unban(userId, reason || undefined);
      },
    };
    deps.enforcer.bind(backend);
  }

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

  // Community greetings (welcome / goodbye / boost) — config-driven.
  const community = new CommunityEvents(settings, sender);

  client.on(Events.GuildMemberAdd, async (member) => {
    await logService
      .log(member.guild.id, "members", `<@${member.id}> (${member.user.tag}) đã tham gia server.`)
      .catch(() => undefined);
    await community
      .onMemberJoin({
        guildId: member.guild.id,
        userId: member.id,
        username: member.user.username,
        guildName: member.guild.name,
        memberCount: member.guild.memberCount,
      })
      .catch((err) => console.error("[puni] welcome failed", err));
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    await logService
      .log(member.guild.id, "members", `<@${member.id}> (${member.user?.tag ?? "?"}) đã rời server.`)
      .catch(() => undefined);
    await community
      .onMemberLeave({
        guildId: member.guild.id,
        userId: member.id,
        username: member.user?.username ?? "Một thành viên",
        guildName: member.guild.name,
        memberCount: member.guild.memberCount,
      })
      .catch((err) => console.error("[puni] goodbye failed", err));
  });

  client.on(Events.MessageCreate, async (msg: Message) => {
    // Boost announcements arrive as system messages in the boost channel.
    if (
      msg.guild &&
      (msg.type === MessageType.GuildBoost ||
        msg.type === MessageType.GuildBoostTier1 ||
        msg.type === MessageType.GuildBoostTier2 ||
        msg.type === MessageType.GuildBoostTier3)
    ) {
      await community
        .onBoost({
          guildId: msg.guild.id,
          userId: msg.author.id,
          username: msg.author.username,
          guildName: msg.guild.name,
          memberCount: msg.guild.memberCount,
        })
        .catch((err) => console.error("[puni] boost greeting failed", err));
      return;
    }
    if (msg.author.bot || !msg.guild) return;
    const rank = rankFromMember({
      isGuildOwner: msg.guild.ownerId === msg.author.id,
      permissions: msg.member?.permissions.bitfield ?? 0n,
    });

    // Automod runs before command dispatch; a deleted message never
    // reaches the dispatcher.
    const guildSettings = await settings.get(msg.guild.id);
    const verdict = checkAutomod(guildSettings.automod, { content: msg.content, authorRank: rank });
    if (verdict.action === "delete") {
      await msg.delete().catch(() => undefined);
      await logService
        .log(
          msg.guild.id,
          "moderation",
          `Automod đã xoá tin nhắn của <@${msg.author.id}> ở <#${msg.channelId}> — luật: ${verdict.rule} (${verdict.detail})`,
        )
        .catch(() => undefined);
      if (guildSettings.automod.warnOnDelete && deps.cases && client.user) {
        await deps.cases
          .create({
            guildId: msg.guild.id,
            targetId: msg.author.id,
            moderatorId: client.user.id,
            action: "warn",
            reason: `Automod: ${verdict.rule}`,
          })
          .catch((err) => console.error("[puni] automod warn case failed", err));
      }
      return;
    }

    // AI chat: a @mention that is not a command gets a cute cat reply.
    let aiGlobalEnabled = true;
    if (deps.aiChat && client.user && msg.mentions.has(client.user.id) && deps.aiGloballyEnabled) {
      aiGlobalEnabled = await deps.aiGloballyEnabled().catch(() => true);
    }
    if (
      deps.aiChat &&
      client.user &&
      shouldTriggerAiChat({
        mentionsBot: msg.mentions.has(client.user.id),
        isCommand: msg.content.trimStart().startsWith(guildSettings.prefix),
        guildEnabled: guildSettings.aiChat.enabled,
        providerConfigured: true,
        globalEnabled: aiGlobalEnabled,
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

  const truncate = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);

  client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guild || msg.author?.bot) return;
    await logService
      .log(
        msg.guild.id,
        "messages",
        `Tin nhắn của <@${msg.author?.id ?? "?"}> đã bị xoá ở <#${msg.channelId}>${msg.content ? `: "${truncate(msg.content)}"` : ""}`,
      )
      .catch(() => undefined);
  });

  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (!oldMsg.content || oldMsg.content === newMsg.content) return;
    await logService
      .log(
        newMsg.guild.id,
        "messages",
        `<@${newMsg.author?.id ?? "?"}> đã sửa tin nhắn ở <#${newMsg.channelId}>\nTrước: "${truncate(oldMsg.content)}"\nSau: "${truncate(newMsg.content ?? "")}"`,
      )
      .catch(() => undefined);
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await logService
      .log(channel.guild.id, "channels", `Kênh mới được tạo: <#${channel.id}> (${channel.name})`)
      .catch(() => undefined);
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await logService
      .log(channel.guild.id, "channels", `Kênh đã bị xoá: #${channel.name}`)
      .catch(() => undefined);
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
    } else if (cmd.commandName === "balance" || cmd.commandName === "cases") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
    } else if (cmd.commandName === "warn") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
      const reason = cmd.options.getString("lydo");
      if (reason) args.push(reason);
    } else if (cmd.commandName === "case") {
      const no = cmd.options.getInteger("so");
      if (no != null) args.push(String(no));
    } else if (cmd.commandName === "mute") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
      args.push(cmd.options.getString("thoiluong") ?? "");
      const reason = cmd.options.getString("lydo");
      if (reason) args.push(reason);
    } else if (cmd.commandName === "unmute" || cmd.commandName === "kick" || cmd.commandName === "ban") {
      const user = cmd.options.getUser("nguoi");
      if (user) mentions.push(user.id);
      const reason = cmd.options.getString("lydo");
      if (reason) args.push(reason);
    } else if (cmd.commandName === "unban") {
      const id = cmd.options.getString("userid");
      if (id) args.push(id);
      const reason = cmd.options.getString("lydo");
      if (reason) args.push(reason);
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
