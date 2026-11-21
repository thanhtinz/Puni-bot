/** Shard worker entry — spawned by the launcher (index.ts), one process
 *  per shard (spec 2.5). All state lives in shared stores, never in this
 *  process, so shards are disposable workers. */
import { loadConfig } from "./config";
import { InMemoryGuildSettings } from "./guild-settings";
import { buildBot } from "./registry";
import { createBotClient } from "./client";

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.token) {
    console.error("[puni] DISCORD_BOT_TOKEN is missing — set it in the environment.");
    process.exit(1);
  }
  const settings = new InMemoryGuildSettings(config.defaultPrefix);
  const { registry } = buildBot({ settings });
  const client = createBotClient({ config, registry, settings });
  await client.login(config.token);
}

main().catch((err) => {
  console.error("[puni] shard failed to start", err);
  process.exit(1);
});
