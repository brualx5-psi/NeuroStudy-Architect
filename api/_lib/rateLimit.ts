type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  limit: number;
};

const globalStore = globalThis as typeof globalThis & { __rateLimitStore?: Map<string, RateLimitEntry> };
const store = globalStore.__rateLimitStore || new Map<string, RateLimitEntry>();
globalStore.__rateLimitStore = store;

export const rateLimit = (key: string, options: RateLimitOptions) => {
  const now = Date.now();
  const existing = store.get(key);
  const entry = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + options.windowMs };

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: entry.count <= options.limit,
    remaining: Math.max(0, options.limit - entry.count),
    resetAt: entry.resetAt
  };
};
