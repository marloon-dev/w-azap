import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { parseDateTimeInZone } from "@/lib/tz";
import { isHttpUrl } from "@/lib/safe-fetch";

// GET: List Scheduled Messages
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const session = await prisma.session.findUnique({
            where: { sessionId: sessionId },
            select: { id: true }
        });

        if (!session) {
            return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });
        }

        const url = new URL(request.url);
        const tab = url.searchParams.get("tab") || "pending";
        
        const whereClause: any = { sessionId: session.id };
        let orderByClause: any = { sendAt: 'asc' };
        
        if (tab === "history") {
            whereClause.status = { in: ["SENT", "FAILED"] };
            orderByClause = { sendAt: 'desc' };
        } else {
            whereClause.status = "PENDING";
        }

        const messages = await prisma.scheduledMessage.findMany({
            where: whereClause,
            include: { session: true },
            orderBy: orderByClause
        });

        return NextResponse.json({ status: true, message: "Scheduled messages retrieved successfully", data: messages });

    } catch {
        return NextResponse.json({ status: false, message: "Internal Server Error", error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Create Scheduled Message
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { jid, content, sendAt, mediaUrl, mediaType, cronExpression, recurrenceRule } = body;

        if (mediaUrl && !isHttpUrl(mediaUrl)) {
            return NextResponse.json({ status: false, message: "mediaUrl must be an http(s) URL", error: "mediaUrl must be an http(s) URL" }, { status: 400 });
        }

        if (!jid || (!content && !mediaUrl) || !sendAt) {
            return NextResponse.json({ status: false, message: "Missing required fields (JID, Content/Media, SendAt)", error: "Missing required fields" }, { status: 400 });
        }

        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const session = await prisma.session.findUnique({
            where: { sessionId: sessionId },
            select: { id: true }
        });

        if (!session) {
            return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });
        }

        // Fetch system timezone
        // @ts-ignore
        const systemConfig = await prisma.systemConfig.findUnique({ where: { id: "default" } });
        const timezone = systemConfig?.timezone || "America/Sao_Paulo";

        const utcDate = parseDateTimeInZone(sendAt, timezone);
        if (Number.isNaN(utcDate.getTime())) {
            return NextResponse.json({ status: false, message: "Invalid sendAt: use YYYY-MM-DDTHH:mm (system timezone) or ISO 8601 with offset", error: "Invalid sendAt" }, { status: 400 });
        }

        const scheduled = await prisma.scheduledMessage.create({
            data: {
                sessionId: session.id,
                jid,
                content,
                mediaUrl,
                mediaType,
                cronExpression,
                recurrenceRule,
                sendAt: utcDate,
                status: "PENDING"
            }
        });

        return NextResponse.json({ status: true, message: "Message scheduled successfully", data: scheduled });

    } catch (error) {
        console.error("Schedule error:", error);
        return NextResponse.json({ status: false, message: "Internal Server Error", error: "Internal Server Error" }, { status: 500 });
    }

}

