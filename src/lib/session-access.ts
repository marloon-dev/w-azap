import { createHash } from "crypto";
import { prisma } from "./prisma";

// Authorization helpers with no NextAuth dependency, so the custom server (Socket.IO) can use them too.

/** API keys are stored as SHA-256 hashes; the plaintext is only shown once at creation. */
export function hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Check if user is admin (SUPERADMIN or has admin privileges)
 */
export function isAdmin(userRole: string): boolean {
    return userRole === "SUPERADMIN";
}

/**
 * Check if user can access a session
 * - SUPERADMIN can access all sessions
 * - Other users can access their own sessions OR sessions shared with them
 */
export async function canAccessSession(userId: string, userRole: string, sessionId: string): Promise<boolean> {
    if (isAdmin(userRole)) {
        return true;
    }

    // Check if session belongs to user (ownership)
    const session = await prisma.session.findFirst({
        where: {
            OR: [
                { id: sessionId, userId },
                { sessionId: sessionId, userId }
            ]
        }
    });

    if (session) return true;

    // Check if user has shared access
    const dbSession = await prisma.session.findFirst({
        where: {
            OR: [
                { id: sessionId },
                { sessionId: sessionId }
            ]
        },
        select: { id: true }
    });

    if (!dbSession) return false;

    const sharedAccess = await prisma.sessionAccess.findUnique({
        where: {
            sessionId_userId: {
                sessionId: dbSession.id,
                userId
            }
        }
    });

    return !!sharedAccess;
}

/**
 * Check if user is the actual owner of a session (not just shared access)
 * Used for protecting management endpoints (e.g. granting/revoking access)
 */
export async function isSessionOwner(userId: string, userRole: string, sessionId: string): Promise<boolean> {
    if (isAdmin(userRole)) {
        return true;
    }

    const session = await prisma.session.findFirst({
        where: {
            OR: [
                { id: sessionId, userId },
                { sessionId: sessionId, userId }
            ]
        }
    });

    return !!session;
}
