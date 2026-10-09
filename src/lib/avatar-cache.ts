import fs from "fs/promises";
import path from "path";
import { avatarFileBase } from "@/lib/avatar-files";
import { waManager } from "@/modules/whatsapp/manager";
import { logger } from "@/lib/logger";

/**
 * Profile pictures, fetched from WhatsApp only when someone looks at them and kept on disk.
 *
 * WhatsApp never pushes the picture itself: contact updates only say it "changed", and the
 * URL from profilePictureUrl() points to a CDN link that expires after a few days. So the
 * thumbnail is downloaded once, stored in data/avatars/<session>/, and served from there.
 * Lookups are queued (a few at a time) so opening a long contact list does not flood the
 * account with queries.
 */

/** A stored picture is refreshed after this long (it is also dropped when WhatsApp says it changed). */
const FRESH_MS = 3 * 24 * 60 * 60 * 1000;
/** "No picture / hidden by privacy" is remembered this long before asking again. */
const NONE_MS = 12 * 60 * 60 * 1000;
const MAX_BYTES = 1024 * 1024;
const MAX_CONCURRENT_LOOKUPS = 2;
const LOOKUP_TIMEOUT_MS = 10_000;

export type AvatarResult =
    | { status: "ok"; data: Buffer; contentType: string }
    /** The contact has no picture, or hides it from this number */
    | { status: "none" }
    /** Could not ask WhatsApp right now (session offline, timeout); try again later */
    | { status: "unavailable" };

async function ageOf(file: string): Promise<number | null> {
    try {
        const stat = await fs.stat(file);
        return Date.now() - stat.mtimeMs;
    } catch {
        return null;
    }
}

// Small queue so a page full of avatars turns into a steady trickle of lookups
let running = 0;
const waiting: (() => void)[] = [];
async function withLookupSlot<T>(task: () => Promise<T>): Promise<T> {
    if (running >= MAX_CONCURRENT_LOOKUPS) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
        return await task();
    } finally {
        running--;
        waiting.shift()?.();
    }
}

const inFlight = new Map<string, Promise<AvatarResult>>();

/** WhatsApp answers "item-not-found" (no picture) or "not-authorized" (privacy) with these codes. */
function isNoPictureError(error: unknown) {
    const err = error as { message?: string; output?: { statusCode?: number }; data?: { tag?: string } };
    const code = err?.output?.statusCode;
    const message = String(err?.message || "");
    return code === 404 || code === 401 || /item-not-found|not-authorized|not-found/i.test(message);
}

async function lookup(sessionId: string, jid: string, base: string, stale: Buffer | null): Promise<AvatarResult> {
    const socket = waManager.getInstance(sessionId)?.socket;
    if (!socket) return stale ? { status: "ok", data: stale, contentType: "image/jpeg" } : { status: "unavailable" };

    try {
        const url = await withLookupSlot(() => socket.profilePictureUrl(jid, "preview", LOOKUP_TIMEOUT_MS));
        if (!url) return await rememberNone(base);

        // Only follow links to WhatsApp's own CDN
        const host = new URL(url).hostname;
        if (!host.endsWith(".whatsapp.net")) {
            logger.warn("Avatar", `Ignoring picture URL on unexpected host ${host}`);
            return await rememberNone(base);
        }

        const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
        const contentType = res.headers.get("content-type") || "image/jpeg";
        if (!res.ok || !contentType.startsWith("image/")) throw new Error(`CDN answered ${res.status} ${contentType}`);
        const data = Buffer.from(await res.arrayBuffer());
        if (data.length === 0 || data.length > MAX_BYTES) throw new Error(`Unexpected picture size ${data.length}`);

        await fs.mkdir(path.dirname(base), { recursive: true });
        await fs.writeFile(`${base}.jpg`, data);
        await fs.rm(`${base}.none`, { force: true });
        return { status: "ok", data, contentType: "image/jpeg" };
    } catch (error) {
        if (isNoPictureError(error)) return await rememberNone(base);
        logger.debug("Avatar", `Could not fetch picture for ${jid}: ${(error as Error)?.message}`);
        return stale ? { status: "ok", data: stale, contentType: "image/jpeg" } : { status: "unavailable" };
    }
}

async function rememberNone(base: string): Promise<AvatarResult> {
    await fs.mkdir(path.dirname(base), { recursive: true });
    await fs.writeFile(`${base}.none`, "");
    await fs.rm(`${base}.jpg`, { force: true });
    return { status: "none" };
}

/** The picture of a contact or group, from disk when fresh, otherwise from WhatsApp. */
export async function getAvatar(sessionId: string, jid: string): Promise<AvatarResult> {
    // Status updates and channels have no picture to ask for
    if (jid === "status@broadcast" || jid.endsWith("@newsletter") || jid.endsWith("@broadcast")) return { status: "none" };

    const base = avatarFileBase(sessionId, jid);

    const noneAge = await ageOf(`${base}.none`);
    if (noneAge !== null && noneAge < NONE_MS) return { status: "none" };

    const picAge = await ageOf(`${base}.jpg`);
    let stale: Buffer | null = null;
    if (picAge !== null) {
        const data = await fs.readFile(`${base}.jpg`);
        if (picAge < FRESH_MS) return { status: "ok", data, contentType: "image/jpeg" };
        stale = data;
    }

    const key = `${sessionId}\n${jid}`;
    let pending = inFlight.get(key);
    if (!pending) {
        pending = lookup(sessionId, jid, base, stale).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
    }
    return pending;
}
