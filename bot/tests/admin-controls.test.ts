/**
 * Owner admin controls wired into the bot: the global on/off switch
 * (maintenance gate), the AI persona extra instructions and the live
 * AI model override — all edited from the Admin panel (bot_config).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CommandRegistry } from "@puni/shared";
import { Dispatcher } from "../src/dispatcher";
import { InMemoryGuildSettings } from "../src/guild-settings";
import {
  AiChatService,
  OpenAiCompatibleProvider,
  buildPersonaPrompt,
} from "../src/services/ai-chat";

function fakeRegistry() {
  const registry = new CommandRegistry();
  registry.register({
    name: "ping",
    description: "fake",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "pong" }),
  });
  return registry;
}

test("maintenance gate: bot off -> non-owner gets the maintenance reply, owner passes", async () => {
  const settings = new InMemoryGuildSettings();
  let off = true;
  const dispatcher = new Dispatcher(fakeRegistry(), settings, async () => 0, "owner-1", {
    botGate: async () => ({ off, message: "Đang bảo trì nhé!" }),
  });
  const userOut = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.deepEqual(userOut, { kind: "maintenance", message: "Đang bảo trì nhé!" });

  const ownerOut = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "owner-1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(ownerOut.kind, "ok");

  off = false;
  const onOut = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(onOut.kind, "ok");
});

test("maintenance gate: a failing gate never blocks commands (fail-open)", async () => {
  const settings = new InMemoryGuildSettings();
  const dispatcher = new Dispatcher(fakeRegistry(), settings, async () => 0, "owner-1", {
    botGate: async () => {
      throw new Error("db down");
    },
  });
  const out = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(out.kind, "ok");
});

test("persona prompt: extra owner instructions are appended, empty extra changes nothing", () => {
  const base = buildPersonaPrompt("Server A");
  assert.equal(buildPersonaPrompt("Server A", ""), base);
  assert.equal(buildPersonaPrompt("Server A", "   "), base);
  const withExtra = buildPersonaPrompt("Server A", "Luôn nhắc mọi người uống nước.");
  assert.ok(withExtra.startsWith(base));
  assert.ok(withExtra.includes("Luôn nhắc mọi người uống nước."));
});

test("ai provider: live model source wins over the env model, failure falls back", async () => {
  const bodies: { model?: string }[] = [];
  const fetchFn = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as { model?: string });
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Chào bạn meo meo ~" } }] }),
    };
  }) as unknown as typeof fetch;

  const live = new OpenAiCompatibleProvider({
    baseUrl: "https://example.invalid/v1",
    apiKey: "test",
    model: "env-model",
    modelSource: async () => "admin-model",
    fetchFn,
  });
  await live.complete("sys", "hi");
  assert.equal(bodies[0]?.model, "admin-model");

  const failing = new OpenAiCompatibleProvider({
    baseUrl: "https://example.invalid/v1",
    apiKey: "test",
    model: "env-model",
    modelSource: async () => {
      throw new Error("db down");
    },
    fetchFn,
  });
  await failing.complete("sys", "hi");
  assert.equal(bodies[1]?.model, "env-model");
});

test("ai chat service: persona extra source reaches the system prompt", async () => {
  let seenPrompt = "";
  const svc = new AiChatService(
    {
      complete: async (systemPrompt: string) => {
        seenPrompt = systemPrompt;
        return "Ừa meo meo ~";
      },
    },
    { personaExtraSource: async () => "Chỉ dẫn riêng của chủ bot." },
  );
  const out = await svc.ask({ guildId: "g1", userId: "u1", text: "chào puni" });
  assert.equal(out.kind, "reply");
  assert.ok(seenPrompt.includes("Chỉ dẫn riêng của chủ bot."));
});
