"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
    /** Public session ID (the one in the URL), used to ask WhatsApp for the picture */
    sessionId: string;
    jid: string;
    /** Name used for the initials while the picture loads or when there is none */
    name?: string | null;
    className?: string;
}

/** First letter of the first two words ("Maria Souza" -> "MS"); one word gives its first two letters. */
function initialsOf(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    // Array.from splits by code point, so emoji stay whole
    const letters = words.length > 1 ? [Array.from(words[0])[0], Array.from(words[1])[0]] : Array.from(words[0]).slice(0, 2);
    return letters.join("").toUpperCase();
}

/** WhatsApp profile picture of a contact or group, with initials as the fallback. */
export function ContactAvatar({ sessionId, jid, name, className }: ContactAvatarProps) {
    const label = name || jid.split("@")[0];
    return (
        <Avatar className={cn("size-10 shrink-0", className)}>
            <AvatarImage
                src={`/api/avatar/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}`}
                alt=""
                className="object-cover"
            />
            <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                {initialsOf(label)}
            </AvatarFallback>
        </Avatar>
    );
}
