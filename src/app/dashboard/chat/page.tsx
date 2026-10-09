import { auth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayoutClient } from "@/components/chat/chat-layout-client";
import { cookies } from "next/headers";
import { canAccessSession } from "@/lib/api-auth";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { getTranslations } from "@/lib/i18n/server";

export default async function ChatPage() {
    const session = await auth();

    if (!session?.user?.id) return <div>{(await getTranslations()).t("guard.unauthorized")}</div>;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;
    let validSessionId: string | null = null;

    if (sessionId) {
        // Validate access
        const hasAccess = await canAccessSession(session.user.id, session.user.role, sessionId);
        if (hasAccess) {
            // Ideally also check if CONNECTED but canAccessSession checks ownership.
            // We can do an extra check if needed.
            validSessionId = sessionId;
        }
    }

    if (!validSessionId) {
        return (
            <SessionGuard>
                <ChatInterface sessionId={null} />
            </SessionGuard>
        );
    }

    // Full-bleed workspace: cancels the main padding so the chat fills the area under the top bar
    return (
        <div className="-mx-4 -my-6 h-[calc(100dvh-4rem)] sm:-mx-6 sm:-my-8 lg:-mx-8">
            <ChatLayoutClient key={validSessionId} sessionId={validSessionId} />
        </div>
    );
}
