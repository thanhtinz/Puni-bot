/**
 * Event logging — spec 6.6. Five toggleable groups (messages, members,
 * server, moderation, channels) writing to one log channel per guild.
 * The service only decides + formats; delivery goes through the same
 * ChannelSender abstraction as community greetings.
 */
import type { LogGroup } from "../moderation-config";
import type { GuildSettingsProvider } from "../guild-settings";
import type { ChannelSender } from "./community";

export class LogService {
  constructor(
    private settings: GuildSettingsProvider,
    private sender: ChannelSender,
  ) {}

  /** Returns true when the entry was actually delivered. */
  async log(guildId: string, group: LogGroup, text: string): Promise<boolean> {
    const cfg = (await this.settings.get(guildId)).logging;
    if (!cfg.enabled || !cfg.channelId || !cfg.groups[group]) return false;
    await this.sender.send(cfg.channelId, text);
    return true;
  }
}
