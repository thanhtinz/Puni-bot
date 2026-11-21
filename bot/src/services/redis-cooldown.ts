/**
 * Redis-backed cooldown store — shares cooldowns across every shard and
 * cluster (spec 2.5), so a user cannot dodge a cooldown by hitting a
 * different shard. Claim is a single atomic `SET key 1 PX <ttl> NX`;
 * when the claim fails, PTTL reports the remaining window.
 *
 * Failure policy: if Redis is unreachable, tryAcquire FAILS OPEN (allows
 * the command) — a cache outage must not take the whole bot down; the
 * incident is logged. Money safety never depends on cooldowns.
 */
import type Redis from "ioredis";
import type { CooldownStore } from "../dispatcher";

const PREFIX = "puni:cd:";

export class RedisCooldownStore implements CooldownStore {
  constructor(private redis: Redis) {}

  async tryAcquire(key: string, ttlSec: number) {
    const fullKey = PREFIX + key;
    try {
      const claimed = await this.redis.set(fullKey, "1", "PX", ttlSec * 1000, "NX");
      if (claimed === "OK") return { ok: true as const };
      const pttl = await this.redis.pttl(fullKey);
      const secondsLeft = pttl > 0 ? Math.ceil(pttl / 1000) : ttlSec;
      return { ok: false as const, secondsLeft };
    } catch (err) {
      console.error("[puni] redis cooldown unavailable — failing open", err);
      return { ok: true as const };
    }
  }
}
