import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, getAccessibleSessions } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

// GET: Fetch sessions (filtered by user role)
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        // Get sessions based on user role
        const sessions = await getAccessibleSessions(user.id, user.role);
        return NextResponse.json({ status: true, message: "Sessions retrieved successfully", data: sessions });
    } catch (error) {
        console.error("Get sessions error:", error);
        return NextResponse.json({ status: false, message: "Failed to fetch sessions", error: "Failed to fetch sessions" }, { status: 500 });
    }
}

// POST: Create new session (always for the authenticated user)
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, sessionId } = body;

        if (!name || typeof name !== "string" || name.trim().length > 100) {
            return NextResponse.json({ status: false, message: "Session name is required (max 100 characters)", error: "Session name is required" }, { status: 400 });
        }

        // Session IDs end up in URLs, socket room names and media file names
        if (sessionId !== undefined && sessionId !== "" && (typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]{3,50}$/.test(sessionId))) {
            return NextResponse.json({ status: false, message: "Session ID must be 3-50 letters, numbers, hyphens or underscores", error: "Invalid session ID" }, { status: 400 });
        }

        // Create session for the authenticated user
        const session = await waManager.createSession(user.id, name.trim(), sessionId || undefined);
        return NextResponse.json({ status: true, message: "Session created successfully", data: session });
    } catch (error) {
        console.error("Create session error:", error);
        return NextResponse.json({ status: false, message: "Failed to create session", error: "Failed to create session" }, { status: 500 });
    }
}
