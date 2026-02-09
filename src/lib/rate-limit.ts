import { LRUCache } from "lru-cache";
import { redis } from "@/lib/redis";
import type { Redis } from "@upstash/redis";

type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

const cache = new LRUCache<string, Entry>({
  max: 5000,
});

export async function rateLimit(key: string, opts: RateLimitOptions) {
  if (redis) {
    return await rateLimitRedis(redis, key, opts);
  }
  return rateLimitMemory(key, opts);
}

async function rateLimitRedis(r: Redis, key: string, opts: RateLimitOptions) {
  const now = Date.now();
  // Lua: INCR + set PEXPIRE on first increment, return {count, ttlMs}
  const script =
    "local c=redis.call('INCR', KEYS[1]); if c==1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; local t=redis.call('PTTL', KEYS[1]); return {c,t};";

  const res = (await r.eval(script, [key], [String(opts.windowMs)])) as [number, number];
  const count = Number(res?.[0] ?? 0);
  const ttlMs = Math.max(0, Number(res?.[1] ?? opts.windowMs));
  const resetAt = now + ttlMs;
  const remaining = Math.max(0, opts.max - count);
  const allowed = count <= opts.max;
  return { allowed, remaining, resetAt };
}

function rateLimitMemory(key: string, opts: RateLimitOptions) {
  const now = Date.now();
  const existing = cache.get(key);
  if (!existing || existing.resetAt <= now) {
    const next: Entry = { count: 1, resetAt: now + opts.windowMs };
    cache.set(key, next);
    return { allowed: true, remaining: opts.max - 1, resetAt: next.resetAt };
  }
  if (existing.count >= opts.max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  cache.set(key, existing);
  return { allowed: true, remaining: Math.max(0, opts.max - existing.count), resetAt: existing.resetAt };
}

export function getRequestIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
