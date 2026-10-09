import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { getAvatar } from "@/lib/avatar-cache";
import { JID_PATTERN } from "@/lib/chat-jid";

// GET: the profile picture of a contact or group, as an image (thumbnail).
// 404 means "no picture" (or hidden by privacy); the dashboard then shows initials.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string; jid: string }> }
) {
    const user = await getAuthenticatedUser(request);
    if (!user) {
        return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, jid: rawJid } = await params;
    if (!(await canAccessSession(user.id, user.role, sessionId))) {
        return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
    }

    const jid = decodeURIComponent(rawJid);
    if (!JID_PATTERN.test(jid)) {
        return NextResponse.json({ status: false, message: "Invalid JID", error: "Invalid JID" }, { status: 400 });
    }

    const avatar = await getAvatar(sessionId, jid);

    if (avatar.status === "ok") {
        return new NextResponse(new Uint8Array(avatar.data), {
            headers: {
                "Content-Type": avatar.contentType,
                // The browser keeps it for a day; the server refreshes its copy every few days
                "Cache-Control": "private, max-age=86400",
                "X-Content-Type-Options": "nosniff",
            },
        });
    }

    return new NextResponse(null, {
        status: avatar.status === "none" ? 404 : 503,
        // Remember "no picture" for a while; retry soon when WhatsApp was unreachable
        headers: { "Cache-Control": avatar.status === "none" ? "private, max-age=21600" : "private, max-age=60" },
    });
}
