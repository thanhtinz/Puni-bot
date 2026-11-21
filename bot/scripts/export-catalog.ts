/**
 * Export the public command catalog for the dashboard's /commands
 * page. The registry is the single source of truth: this script
 * builds the bot in-memory (no Discord connection), takes
 * registry.publicCommands() — community commands only, shop/mod/admin
 * excluded by the registry itself — strips the handlers, and writes
 * dashboard/src/data/command-catalog.json.
 *
 * Run after changing commands:  npx tsx scripts/export-catalog.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBot } from "../src/registry";
import { InMemoryGuildSettings } from "../src/guild-settings";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../dashboard/src/data/command-catalog.json");

const { registry } = buildBot({ settings: new InMemoryGuildSettings() });
const catalog = registry.publicCommands().map((c) => ({
  name: c.name,
  aliases: c.aliases ?? [],
  description: c.description,
  module: c.module,
  slash: c.slash,
  prefix: c.prefix,
}));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Wrote ${catalog.length} public commands to ${out}`);
