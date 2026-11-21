/**
 * AI chat tests — persona law (cute cat, every reply ends with
 * "meo meo ~"), trigger predicate, cooldown, empty-mention canned
 * replies, and the OpenAI-compatible provider against a local stub
 * HTTP server (real request/response wiring, no external network).
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  AiChatService,
  OpenAiCompatibleProvider,
  buildPersonaPrompt,
  enforceMeoMeo,
  pickEmptyMentionReply,
  shouldTriggerAiChat,
  stripBotMention,
  type AiProvider,
} from "../src/services/ai-chat";
import { normalizeAiChatConfig } from "../src/ai-config";

let passed = 0;
function ok(name: string) {
  passed++;
  console.log(`PASS ${name}`);
}

async function main() {
  // Persona prompt carries the style law.
  const prompt = buildPersonaPrompt("BNT Shop");
  assert.match(prompt, /Puni/);
  assert.match(prompt, /meo meo ~/);
  assert.match(prompt, /BNT Shop/);
  ok("persona prompt: cat identity + meo meo law + guild name");

  // enforceMeoMeo: appends when missing, keeps when present, caps length.
  assert.equal(enforceMeoMeo("Chào bạn!"), "Chào bạn meo meo ~");
  assert.equal(enforceMeoMeo("Chào bạn meo meo ~"), "Chào bạn meo meo ~");
  assert.equal(enforceMeoMeo("Ừa meo meo"), "Ừa meo meo ~");
  assert.ok(enforceMeoMeo("x".repeat(5000)).length <= 1802);
  assert.match(enforceMeoMeo(""), /meo meo ~/);
  ok("enforceMeoMeo: appends, normalizes, caps, empty-safe");

  // Trigger predicate: mention + not command + guild on + provider on.
  const base = { mentionsBot: true, isCommand: false, guildEnabled: true, providerConfigured: true };
  assert.equal(shouldTriggerAiChat(base), true);
  assert.equal(shouldTriggerAiChat({ ...base, mentionsBot: false }), false);
  assert.equal(shouldTriggerAiChat({ ...base, isCommand: true }), false);
  assert.equal(shouldTriggerAiChat({ ...base, guildEnabled: false }), false);
  assert.equal(shouldTriggerAiChat({ ...base, providerConfigured: false }), false);
  ok("shouldTriggerAiChat: all four gates");

  // Mention stripping.
  assert.equal(stripBotMention("<@123> chào puni ơi", "123"), "chào puni ơi");
  assert.equal(stripBotMention("<@!123>", "123"), "");
  assert.equal(stripBotMention("này <@123> nghe không", "123"), "này nghe không");
  ok("stripBotMention: both mention forms removed");

  // Empty-mention canned replies are deterministic and on-brand.
  const canned = pickEmptyMentionReply("847746890808164383");
  assert.equal(canned, pickEmptyMentionReply("847746890808164383"));
  assert.match(canned, /meo meo ~/);
  ok("empty mention: deterministic canned reply, no API spend");

  // Per-guild config normalize.
  assert.deepEqual(normalizeAiChatConfig(undefined), { enabled: true });
  assert.deepEqual(normalizeAiChatConfig({ enabled: false }), { enabled: false });
  assert.deepEqual(normalizeAiChatConfig({ enabled: "yes" }), { enabled: true });
  assert.deepEqual(normalizeAiChatConfig(null), { enabled: true });
  ok("normalizeAiChatConfig: default on, explicit off respected");

  // Service: provider reply without the ending gets it enforced;
  // a second immediate ask hits the cooldown and never calls the provider.
  let calls = 0;
  const fake: AiProvider = {
    async complete(system, user) {
      calls++;
      assert.match(system, /meo meo ~/);
      assert.ok(user.length <= 500);
      return "Puni khỏe lắm, cảm ơn bạn đã hỏi!";
    },
  };
  const svc = new AiChatService(fake);
  const first = await svc.ask({ guildId: "g1", userId: "u1", text: "puni khỏe không" });
  assert.deepEqual(first, { kind: "reply", text: "Puni khỏe lắm, cảm ơn bạn đã hỏi meo meo ~" });
  const second = await svc.ask({ guildId: "g1", userId: "u1", text: "hỏi nữa nè" });
  assert.equal(second.kind, "cooldown");
  assert.equal(calls, 1);
  const other = await svc.ask({ guildId: "g1", userId: "u2", text: "chào puni" });
  assert.equal(other.kind, "reply");
  assert.equal(calls, 2);
  ok("AiChatService: enforcement + per-user cooldown + provider not re-called");

  // Service: provider failure becomes a quiet error outcome.
  const failing = new AiChatService({
    async complete() {
      throw new Error("boom");
    },
  });
  const err = await failing.ask({ guildId: "g1", userId: "u9", text: "hi" });
  assert.equal(err.kind, "error");
  ok("AiChatService: provider failure -> error outcome");

  // Provider against a local stub server: verifies URL, auth header,
  // body shape and response parsing end to end.
  let seenAuth = "";
  let seenBody: Record<string, unknown> = {};
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seenAuth = String(req.headers.authorization ?? "");
      seenBody = JSON.parse(body) as Record<string, unknown>;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "Meo, Puni đây!" } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const provider = new OpenAiCompatibleProvider({
    baseUrl: `http://127.0.0.1:${addr.port}/v1`,
    apiKey: "test-key-123",
    model: "stub-model",
  });
  const reply = await provider.complete("SYS", "chào");
  assert.equal(reply, "Meo, Puni đây!");
  assert.equal(seenAuth, "Bearer test-key-123");
  assert.equal(seenBody.model, "stub-model");
  const msgs = seenBody.messages as { role: string; content: string }[];
  assert.equal(msgs[0].role, "system");
  assert.equal(msgs[1].content, "chào");
  server.close();
  ok("OpenAiCompatibleProvider: stub server round-trip (auth, body, parse)");

  console.log(`\n${passed} ai-chat tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
