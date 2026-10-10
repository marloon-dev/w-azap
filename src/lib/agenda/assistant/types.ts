import type { AgendaConfig } from "@prisma/client";
import type { Conversation } from "./conversation";

/** One incoming customer message, whatever the channel (WhatsApp or the panel simulator). */
export interface Turn {
    dbSessionId: string;
    config: AgendaConfig;
    /** Identifies the customer's appointments (phone JID on WhatsApp) */
    customerJid: string;
    customerName: string | null;
    text: string;
    now: Date;
    conversation: Conversation;
    reply: (text: string) => Promise<void>;
}
