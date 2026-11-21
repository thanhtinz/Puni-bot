/**
 * Community greeting events — spec 6.5. Welcome / goodbye / boost
 * messages, driven entirely by per-guild config (guild settings) and a
 * channel sender abstraction, so the behavior is unit-testable without
 * a Discord connection. Returns true when a message was actually sent.
 */
import { renderTemplate, type GreetingConfig } from "../community-config";
import type { GuildSettingsProvider } from "../guild-settings";

export interface ChannelSender {
  send(channelId: string, text: string): Promise<void>;
}

export interface MemberEvent {
  guildId: string;
  userId: string;
  username: string;
  guildName: string;
  memberCount: number;
}

export class CommunityEvents {
  constructor(
    private settings: GuildSettingsProvider,
    private sender: ChannelSender,
  ) {}

  private async greet(
    pick: (cfg: { welcome: GreetingConfig; goodbye: GreetingConfig; boost: GreetingConfig }) => GreetingConfig,
    e: MemberEvent,
  ): Promise<boolean> {
    const settings = await this.settings.get(e.guildId);
    const cfg = pick(settings.community);
    if (!cfg.enabled || !cfg.channelId) return false;
    const text = renderTemplate(cfg.message, {
      user: `<@${e.userId}>`,
      username: e.username,
      server: e.guildName,
      count: e.memberCount,
    });
    await this.sender.send(cfg.channelId, text);
    return true;
  }

  onMemberJoin(e: MemberEvent): Promise<boolean> {
    return this.greet((c) => c.welcome, e);
  }

  onMemberLeave(e: MemberEvent): Promise<boolean> {
    return this.greet((c) => c.goodbye, e);
  }

  onBoost(e: MemberEvent): Promise<boolean> {
    return this.greet((c) => c.boost, e);
  }
}
