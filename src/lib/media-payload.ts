import { downloadMedia, UnsafeUrlError } from "./safe-fetch";

const MEDIA_KEYS = ["image", "video", "audio", "document", "sticker", "ptv"] as const;

/**
 * Baileys treats `{ url }` values that are not http(s) as LOCAL FILE PATHS and streams them.
 * Every user-influenced message payload must go through this before `sock.sendMessage`:
 * media URLs are downloaded with SSRF protection and replaced by Buffers, and any `url`
 * left anywhere in the payload is rejected.
 */
export async function resolveMediaPayload<T>(payload: T): Promise<T> {
    if (payload == null || typeof payload !== "object") return payload;
    const out: Record<string, any> = { ...(payload as Record<string, any>) };

    for (const key of MEDIA_KEYS) {
        const value = out[key];
        if (value == null || Buffer.isBuffer(value)) continue;
        const url = typeof value === "string" ? value : typeof value === "object" ? value.url : undefined;
        if (typeof url === "string") {
            const { buffer } = await downloadMedia(url);
            out[key] = buffer;
        }
    }

    // Anything Baileys would upload must now be a Buffer. A stream or other object here could
    // still point Baileys at the filesystem, so refuse it.
    for (const key of MEDIA_KEYS) {
        const value = out[key];
        if (value != null && !Buffer.isBuffer(value)) {
            throw new UnsafeUrlError(`Unsupported value for "${key}": provide an http(s) URL`);
        }
    }
    return out as T;
}
