import { lookup } from "dns/promises";
import net from "net";

/**
 * Outbound HTTP for user-supplied URLs (media URLs, webhooks, stickers).
 *
 * - Only http/https: anything else (file paths, file://, data:) is rejected, so a "media URL"
 *   can never make Baileys read a local file.
 * - Blocks loopback, private, link-local (cloud metadata), CGNAT and other non-public ranges,
 *   re-checked on every redirect hop (SSRF).
 * - Timeout and response size cap.
 */

export class UnsafeUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsafeUrlError";
    }
}

const MAX_REDIRECTS = 5;

function ipv4ToInt(ip: string): number {
    return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const BLOCKED_V4: [string, number][] = [
    ["0.0.0.0", 8],        // "this" network
    ["10.0.0.0", 8],       // private
    ["100.64.0.0", 10],    // CGNAT
    ["127.0.0.0", 8],      // loopback
    ["169.254.0.0", 16],   // link-local / cloud metadata
    ["172.16.0.0", 12],    // private
    ["192.0.0.0", 24],     // IETF protocol assignments
    ["192.0.2.0", 24],     // TEST-NET-1
    ["192.168.0.0", 16],   // private
    ["198.18.0.0", 15],    // benchmarking
    ["198.51.100.0", 24],  // TEST-NET-2
    ["203.0.113.0", 24],   // TEST-NET-3
    ["224.0.0.0", 4],      // multicast
    ["240.0.0.0", 4],      // reserved + broadcast
];

export function isPrivateAddress(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const value = ipv4ToInt(ip);
        return BLOCKED_V4.some(([base, bits]) => {
            const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
            return (value & mask) === (ipv4ToInt(base) & mask);
        });
    }
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        // IPv4-mapped (::ffff:a.b.c.d) -> check the embedded v4 address
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateAddress(mapped[1]);
        return (
            lower === "::" ||
            lower === "::1" ||
            lower.startsWith("fc") || lower.startsWith("fd") ||   // unique local
            lower.startsWith("fe8") || lower.startsWith("fe9") ||  // link-local
            lower.startsWith("fea") || lower.startsWith("feb") ||
            lower.startsWith("ff") ||                              // multicast
            lower.startsWith("64:ff9b:") ||                        // NAT64
            lower.startsWith("2001:db8")                           // documentation
        );
    }
    return true;
}

/** Validate scheme and that the host resolves only to public addresses. Throws UnsafeUrlError. */
export async function assertPublicHttpUrl(raw: string, opts: { allowPrivate?: boolean } = {}): Promise<URL> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new UnsafeUrlError("Invalid URL");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new UnsafeUrlError("Only http(s) URLs are allowed");
    }
    if (url.username || url.password) {
        throw new UnsafeUrlError("URLs with credentials are not allowed");
    }
    if (opts.allowPrivate) return url;

    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = net.isIP(host)
        ? [host]
        : (await lookup(host, { all: true, verbatim: true }).catch(() => {
            throw new UnsafeUrlError("Could not resolve host");
        })).map(a => a.address);

    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        throw new UnsafeUrlError("URL points to a private or reserved network address");
    }
    return url;
}

/** Cheap synchronous check for input validation (scheme only; network checks happen at fetch time). */
export function isHttpUrl(raw: unknown): raw is string {
    if (typeof raw !== "string") return false;
    try {
        const u = new URL(raw);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

interface SafeFetchOptions extends Omit<RequestInit, "redirect" | "signal"> {
    timeoutMs?: number;
    allowPrivate?: boolean;
}

/** fetch() that validates every hop. The returned Response is the final, non-redirect response. */
export async function safeFetch(raw: string, options: SafeFetchOptions = {}): Promise<Response> {
    const { timeoutMs = 15000, allowPrivate = false, ...init } = options;
    const signal = AbortSignal.timeout(timeoutMs);
    let current = raw;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const url = await assertPublicHttpUrl(current, { allowPrivate });
        const res = await fetch(url, { ...init, redirect: "manual", signal });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            current = new URL(res.headers.get("location")!, url).toString();
            // Redirects become GET without body, like browsers do for 301/302/303
            if (res.status !== 307 && res.status !== 308) {
                init.method = "GET";
                delete init.body;
            }
            continue;
        }
        return res;
    }
    throw new UnsafeUrlError("Too many redirects");
}

export function maxUploadBytes(): number {
    const mb = Number(process.env.MAX_UPLOAD_SIZE_MB) || 50;
    return mb * 1024 * 1024;
}

/** Download a user-supplied media URL into memory, enforcing the upload size limit. */
export async function downloadMedia(raw: string, timeoutMs = 30000): Promise<{ buffer: Buffer; contentType: string | null }> {
    const res = await safeFetch(raw, { timeoutMs });
    if (!res.ok) throw new Error(`Failed to fetch media: HTTP ${res.status}`);

    const limit = maxUploadBytes();
    const declared = Number(res.headers.get("content-length"));
    if (declared && declared > limit) throw new Error("Media exceeds the maximum allowed size");

    const reader = res.body?.getReader();
    if (!reader) return { buffer: Buffer.alloc(0), contentType: res.headers.get("content-type") };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
            await reader.cancel();
            throw new Error("Media exceeds the maximum allowed size");
        }
        chunks.push(value);
    }
    return { buffer: Buffer.concat(chunks), contentType: res.headers.get("content-type") };
}

/** Webhooks may target a private network only when the operator opts in (e.g. n8n on the same host). */
export function webhooksAllowPrivate(): boolean {
    return process.env.ALLOW_PRIVATE_WEBHOOK_URLS === "true";
}
