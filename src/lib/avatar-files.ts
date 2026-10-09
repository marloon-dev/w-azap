import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * Where profile pictures are stored on disk (data/avatars/<session>/<sha1 of the JID>.jpg|.none).
 * Kept free of WhatsApp imports so the message store can invalidate pictures without a cycle.
 */
const AVATAR_ROOT = path.join(process.cwd(), "data", "avatars");

export function avatarSessionDir(sessionId: string) {
    return path.join(AVATAR_ROOT, sessionId.replace(/[^\w-]/g, "_"));
}

/** Path without extension: `${base}.jpg` is the picture, `${base}.none` marks "no picture". */
export function avatarFileBase(sessionId: string, jid: string) {
    return path.join(avatarSessionDir(sessionId), crypto.createHash("sha1").update(jid).digest("hex"));
}

/** Forget the stored picture (WhatsApp reported a new one, or it was removed). */
export async function invalidateAvatar(sessionId: string, jid: string) {
    const base = avatarFileBase(sessionId, jid);
    await Promise.all([fs.rm(`${base}.jpg`, { force: true }), fs.rm(`${base}.none`, { force: true })]);
}

/** Drop every stored picture of a session (used when the session is deleted). */
export async function clearSessionAvatars(sessionId: string) {
    await fs.rm(avatarSessionDir(sessionId), { recursive: true, force: true });
}

/**
 * Contact updates carry `imgUrl: "changed"` (or null when removed), never a usable link.
 * Returns what to store in Contact.profilePic: a real URL, null to clear it, or undefined to keep it.
 */
export function profilePicFromUpdate(imgUrl: unknown): string | null | undefined {
    if (imgUrl === undefined) return undefined;
    return typeof imgUrl === "string" && imgUrl.startsWith("http") ? imgUrl : null;
}
