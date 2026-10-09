import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { logger } from "./logger";

/**
 * AES-256-GCM encryption for secrets at rest (WhatsApp session keys).
 *
 * Key: DATA_ENCRYPTION_KEY (32 bytes, base64 or hex). If unset, a key is derived from AUTH_SECRET so
 * existing installs keep working — but then rotating AUTH_SECRET makes stored sessions unreadable,
 * so a dedicated DATA_ENCRYPTION_KEY is recommended.
 */

export interface EncryptedBlob {
    enc: "v1";
    iv: string;
    tag: string;
    data: string;
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
    if (cachedKey) return cachedKey;
    const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
    if (raw) {
        const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
        if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
        cachedKey = key;
    } else {
        if (!process.env.AUTH_SECRET) throw new Error("DATA_ENCRYPTION_KEY or AUTH_SECRET is required");
        logger.warn("Crypto", "DATA_ENCRYPTION_KEY not set; deriving the data key from AUTH_SECRET");
        cachedKey = createHash("sha256").update(`w-azap:data-encryption:v1:${process.env.AUTH_SECRET}`).digest();
    }
    return cachedKey;
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
    return !!value && typeof value === "object" && (value as any).enc === "v1"
        && typeof (value as any).iv === "string" && typeof (value as any).data === "string";
}

export function encryptString(plaintext: string, aad?: string): EncryptedBlob {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
    if (aad) cipher.setAAD(Buffer.from(aad));
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return { enc: "v1", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptString(blob: EncryptedBlob, aad?: string): string {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(blob.iv, "base64"));
    if (aad) decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]).toString("utf8");
}
