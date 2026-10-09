import { prisma } from "@/lib/prisma";
import { getLatestRelease } from "@/lib/github";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";

// We'll store the last check time or version in memory or rely on Notification existence
// For simplicity, we just check if a notification with this version title exists for the user.

const REPO_OWNER = "marloon-dev";
const REPO_NAME = "w-azap";

import { NextRequest } from "next/server";
import pkg from "../../../../../package.json";

/** True when release tag `latest` (e.g. "v1.7.0") is newer than `current` ("1.6.4"). */
function isNewer(latest: string, current: string): boolean {
    const parse = (v: string) => v.replace(/^v/i, "").split(/[.-]/).map(n => parseInt(n, 10) || 0);
    const a = parse(latest), b = parse(current);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
    }
    return false;
}

// GitHub allows 60 unauthenticated requests/hour; the dashboard calls this on every load
const CACHE_MS = 60 * 60_000;
const cache: { at: number; release: Awaited<ReturnType<typeof getLatestRelease>> } =
    ((globalThis as any).__wazapReleaseCache ??= { at: 0, release: null });

async function getCachedRelease() {
    if (cache.release && Date.now() - cache.at < CACHE_MS) return cache.release;
    const release = await getLatestRelease(REPO_OWNER, REPO_NAME);
    if (release) {
        cache.release = release;
        cache.at = Date.now();
    }
    return release;
}

export async function POST(req: NextRequest) {
    const user = await getAuthenticatedUser(req); // Support API Key
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    // Update notices are for administrators only
    if (user.role !== "SUPERADMIN") return NextResponse.json({ status: false, message: "Forbidden", error: "Forbidden" }, { status: 403 });
    const session = { user };

    try {
        const release = await getCachedRelease();
        if (!release) return NextResponse.json({ status: false, message: "Could not fetch release", error: "Could not fetch release" });

        const version = release.tag_name;
        if (!isNewer(version, pkg.version)) {
            return NextResponse.json({ status: true, message: "Already up to date", data: { version, current: pkg.version } });
        }
        const title = `New Update Available: ${version}`;

        // Check if we already notified this user about this version
        const existing = await prisma.notification.findFirst({
            where: {
                userId: session.user.id,
                title: title
            }
        });

        if (existing) {
            return NextResponse.json({ status: true, message: "Already up to date (notification exists)", data: { version } });
        }

        // Create notification
        const notification = await prisma.notification.create({
            data: {
                userId: session.user.id,
                title: title,
                message: `A new version (${version}) of W-AZAP is available! Check it out on GitHub.\n\n${release.name}`,
                type: "SYSTEM",
                href: release.html_url
            }
        });

        // Emit Socket.IO event
        const io = (global as any).io;
        if (io) {
            io.to(`user:${session.user.id}`).emit('notification:new', {
                id: notification.id,
                userId: session.user.id,
                title,
                message: notification.message,
                type: "SYSTEM",
                href: release.html_url,
                createdAt: notification.createdAt
            });
        }

        return NextResponse.json({ status: true, message: "Notification sent", data: { version } });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ status: false, message: "Error checking updates", error: "Error checking updates" }, { status: 500 });
    }
}
