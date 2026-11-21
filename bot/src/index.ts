/** Cluster launcher — spec 2.5 (Shard + Cluster).
 *  Spawns one worker process per shard via ShardingManager. v1 runs a
 *  single cluster on one host; scaling out means running more clusters —
 *  handlers are stateless, so no business code changes when that happens. */
import { ShardingManager } from "discord.js";
import * as path from "node:path";
import { loadConfig } from "./config";

function main(): void {
  const config = loadConfig();
  if (!config.token) {
    console.error("[puni] DISCORD_BOT_TOKEN is missing — set it in the environment.");
    process.exit(1);
  }
  const manager = new ShardingManager(path.join(__dirname, "shard.js"), {
    token: config.token,
    totalShards: config.totalShards,
    mode: "process",
  });
  manager.on("shardCreate", (shard) => {
    console.log(`[puni] shard ${shard.id} launched`);
    shard.on("ready", () => console.log(`[puni] shard ${shard.id} ready`));
    shard.on("death", () => console.error(`[puni] shard ${shard.id} died — manager will respawn per policy`));
  });
  manager.spawn().catch((err) => {
    console.error("[puni] failed to spawn shards", err);
    process.exit(1);
  });
}

main();
