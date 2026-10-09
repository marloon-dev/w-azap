/**
 * In-memory fixed-window rate limiter. The app runs as a single Node process (custom server),
 * so process memory is a valid store. State lives on globalThis so the custom server and the
 * Next.js route bundles share the same buckets.
 */

interface Bucket {
    count: number;
    resetAt: number;
}

const store: Map<string, Bucket> =
    ((globalThis as any).__wazapRateLimit ??= new Map<string, Bucket>());

let lastSweep = 0;
function sweep(now: number) {
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [key, bucket] of store) if (bucket.resetAt <= now) store.delete(key);
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

/** Count one hit against `key`; `allowed` is false once `limit` hits happened within `windowMs`. */
export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    sweep(now);
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        store.set(key, bucket);
    }
    bucket.count++;
    return {
        allowed: bucket.count <= limit,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
}

/** Check without counting. */
export function peek(key: string, limit: number): RateLimitResult {
    const now = Date.now();
    const bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    return {
        allowed: bucket.count < limit,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
}

export function reset(key: string) {
    store.delete(key);
}

/** Login brute-force protection: per account and per IP. */
export const LOGIN_LIMITS = {
    perAccount: { limit: 5, windowMs: 15 * 60_000 },
    perIp: { limit: 20, windowMs: 15 * 60_000 },
};

export function clientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
    const get = (name: string) =>
        headers instanceof Headers ? headers.get(name) : (headers[name] as string | undefined);
    // Only trust proxy headers when explicitly running behind a reverse proxy
    if (process.env.TRUST_PROXY === "true") {
        const fwd = get("x-forwarded-for");
        if (fwd) return fwd.split(",")[0].trim();
        const real = get("x-real-ip");
        if (real) return real;
    }
    return get("x-wazap-remote-addr") || "unknown";
}
