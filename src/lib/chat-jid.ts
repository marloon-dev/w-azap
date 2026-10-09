/** Country code added to local numbers typed with a leading 0 (trunk prefix), e.g. 011987654321 -> 5511987654321. */
const DEFAULT_COUNTRY_CODE = "55";

/** JIDs the chat can open: users, groups, LIDs, broadcast lists and channels. */
const JID_PATTERN = /^[\w.:-]+@(s\.whatsapp\.net|g\.us|lid|broadcast|newsletter)$/;

/**
 * Turns the chat URL segment back into a WhatsApp JID.
 * The URL keeps the full JID (so groups stay groups after a reload); a bare number is a private chat.
 */
export function jidFromUrlSegment(segment: string): string {
    let raw = segment.trim();
    try {
        raw = decodeURIComponent(raw);
    } catch {
        // Malformed escape: use the segment as typed
    }
    if (JID_PATTERN.test(raw)) return raw;
    return jidFromPhoneNumber(raw.split("@")[0]);
}

/** A phone number as typed ("+55 (11) 98765-4321", "011 98765-4321") -> private chat JID. */
export function jidFromPhoneNumber(input: string): string {
    let digits = input.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = DEFAULT_COUNTRY_CODE + digits.replace(/^0+/, "");
    return `${digits}@s.whatsapp.net`;
}

/** URL segment for a chat: private chats show just the number, everything else keeps its JID. */
export function urlSegmentFromJid(jid: string): string {
    return jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : encodeURIComponent(jid);
}
