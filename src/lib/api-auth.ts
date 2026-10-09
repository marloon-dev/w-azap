import { prisma } from "./prisma";
import { NextRequest } from "next/server";
import { auth } from "./auth";
import { logger } from "./logger";
import { randomBytes } from "crypto";
import { hashApiKey, isAdmin, canAccessSession, isSessionOwner } from "./session-access";

export { hashApiKey, isAdmin, canAccessSession, isSessionOwner };

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
    SUPERADMIN: 3,
    OWNER: 2,
    STAFF: 1
} as const;

type Role = keyof typeof ROLE_HIERARCHY;

/**
 * Validate API key from request header
 */
export async function validateApiKey(request: NextRequest) {
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey || apiKey.length > 200) {
        return null;
    }

    try {
        const select = { id: true, email: true, name: true, role: true } as const;
        const user = await prisma.user.findUnique({ where: { apiKey: hashApiKey(apiKey) }, select });
        if (user) return user;

        // Legacy keys were stored in plaintext: accept once and migrate to the hashed form
        const legacy = await prisma.user.findUnique({ where: { apiKey }, select });
        if (legacy) {
            await prisma.user.update({
                where: { id: legacy.id },
                data: { apiKey: hashApiKey(apiKey), apiKeyHint: apiKey.slice(0, 8) },
            });
            return legacy;
        }
        return null;
    } catch (error) {
        logger.error("Auth", "API key validation error:", error);
        return null;
    }
}

/**
 * Get authenticated user from either session or API key
 */
export async function getAuthenticatedUser(request?: NextRequest, options: { allowApiKey?: boolean } = {}) {
    const { allowApiKey = true } = options;

    // First try API key if request is provided
    if (request && allowApiKey) {
        const apiKeyUser = await validateApiKey(request);
        if (apiKeyUser) {
            return { ...apiKeyUser, authMethod: "apiKey" as const };
        }
    }

    // Fall back to session auth
    const session = await auth();
    if (session?.user?.id) {
        // Fetch full user data including role
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, email: true, name: true, role: true }
        });

        if (user) {
            return { ...user, authMethod: "session" as const };
        }
    }

    return null;
}

/**
 * Check if user has required role level
 */
export function hasRole(userRole: string, requiredRole: Role): boolean {
    const userLevel = ROLE_HIERARCHY[userRole as Role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
}

// Session listings never include webhook HMAC secrets
const WEBHOOK_PUBLIC_FIELDS = {
    id: true, name: true, url: true, events: true, isActive: true, sessionId: true, userId: true, createdAt: true, updatedAt: true,
} as const;

/** Mask third-party credentials before sessions leave the server */
function maskSessionSecrets<T extends { botConfig?: any }>(sessions: T[]): T[] {
    return sessions.map(s => s.botConfig?.removeBgApiKey
        ? { ...s, botConfig: { ...s.botConfig, removeBgApiKey: "••••••••" } }
        : s);
}

/**
 * Get sessions that user can access
 * - SUPERADMIN sees all
 * - Others see only their own
 */
export async function getAccessibleSessions(userId: string, userRole: string) {
    if (isAdmin(userRole)) {
        return maskSessionSecrets(await prisma.session.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                botConfig: true,
                webhooks: { select: WEBHOOK_PUBLIC_FIELDS },
                _count: {
                    select: {
                        contacts: true,
                        messages: true,
                        groups: true,
                        autoReplies: true,
                        scheduledMessages: true
                    }
                }
            }
        }));
    }

    // Get sessions owned by user + sessions shared with user
    const [ownedSessions, sharedAccess] = await Promise.all([
        prisma.session.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                botConfig: true,
                webhooks: { select: WEBHOOK_PUBLIC_FIELDS },
                _count: {
                    select: {
                        contacts: true,
                        messages: true,
                        groups: true,
                        autoReplies: true,
                        scheduledMessages: true
                    }
                }
            }
        }),
        prisma.sessionAccess.findMany({
            where: { userId },
            select: { sessionId: true }
        })
    ]);

    if (sharedAccess.length === 0) return maskSessionSecrets(ownedSessions);

    const sharedSessionIds = sharedAccess.map(a => a.sessionId);
    const ownedIds = new Set(ownedSessions.map(s => s.id));
    const missingIds = sharedSessionIds.filter(id => !ownedIds.has(id));

    if (missingIds.length === 0) return maskSessionSecrets(ownedSessions);

    const sharedSessions = await prisma.session.findMany({
        where: { id: { in: missingIds } },
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    name: true,
                    email: true
                }
            },
            botConfig: true,
            webhooks: { select: WEBHOOK_PUBLIC_FIELDS },
            _count: {
                select: {
                    contacts: true,
                    messages: true,
                    groups: true,
                    autoReplies: true,
                    scheduledMessages: true
                }
            }
        }
    });

    return maskSessionSecrets([...ownedSessions, ...sharedSessions]);
}

/**
 * Generate a new API key (192 bits from the OS CSPRNG)
 */
export function generateApiKey(): string {
    return "wag_" + randomBytes(24).toString("base64url");
}
