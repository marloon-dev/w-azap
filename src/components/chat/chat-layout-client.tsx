"use client";

import { useState, useEffect } from "react";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/components/i18n-provider";
import { jidFromUrlSegment, urlSegmentFromJid } from "@/lib/chat-jid";

interface ChatLayoutClientProps {
    sessionId: string;
    initialJid?: string;
}

interface SelectedChat {
    jid: string;
    name?: string;
}

export function ChatLayoutClient({ sessionId, initialJid }: ChatLayoutClientProps) {
    const { t } = useTranslation();
    const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(
        initialJid ? { jid: initialJid } : null
    );

    // Sync selected chat to URL pathname
    useEffect(() => {
        if (typeof window === "undefined") return;
        const base = "/dashboard/chat";
        if (selectedChat) {
            const newPath = `${base}/${urlSegmentFromJid(selectedChat.jid)}`;
            if (window.location.pathname !== newPath) {
                window.history.replaceState(null, "", newPath);
            }
        } else {
            if (window.location.pathname !== base) {
                window.history.replaceState(null, "", base);
            }
        }
    }, [selectedChat]);

    // Handle browser back/forward
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname;
            if (path.startsWith("/dashboard/chat/")) {
                setSelectedChat({ jid: jidFromUrlSegment(path.replace("/dashboard/chat/", "")) });
            } else {
                setSelectedChat(null);
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const handleSelectChat = (jid: string, name?: string) => {
        setSelectedChat({ jid, name });
    };

    const handleBack = () => {
        setSelectedChat(null);
        if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/dashboard/chat");
        }
    };

    return (
        // Outer: flex row, full height, overflow hidden — containment chain root
        <div className="flex h-full min-h-0 overflow-hidden bg-card">
            {/* Chat List Panel */}
            <div className={`w-full md:w-80 lg:w-[360px] border-r border-border overflow-hidden shrink-0 flex flex-col
                ${selectedChat ? "hidden md:flex" : "flex"}`}
            >
                {/* Inner flex-col: header fixed + virtuoso fills rest */}
                <ChatList
                    sessionId={sessionId}
                    onSelectChat={handleSelectChat}
                    selectedJid={selectedChat?.jid}
                />
            </div>

            {/* Chat Window Panel */}
            <div className={`flex-1 overflow-hidden flex flex-col min-w-0
                ${!selectedChat ? "hidden md:flex" : "flex"}`}
            >
                {selectedChat ? (
                    <ChatWindow
                        sessionId={sessionId}
                        jid={selectedChat.jid}
                        name={selectedChat.name}
                        onBack={handleBack}
                    />
                ) : (
                    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-background">
                        <div className="max-w-xs p-6 text-center">
                            <MessageCircle className="mx-auto mb-3 size-8 text-muted-foreground/60" strokeWidth={1.5} aria-hidden="true" />
                            <p className="text-sm text-muted-foreground">{t("chat.selectChat")}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
