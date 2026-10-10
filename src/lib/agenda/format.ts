/** Display helpers shared by the WhatsApp assistant and notifications (customer-facing text is pt-BR). */

export function formatPrice(cents: number | null | undefined): string | null {
    if (cents === null || cents === undefined) return null;
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

/** "5511987654321@s.whatsapp.net" → "+55 11 98765-4321" (best effort for Brazilian numbers) */
export function formatPhoneFromJid(jid: string): string {
    if (jid.endsWith("@agenda.local")) return "teste pelo simulador";
    const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
    if (!digits) return jid;
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        const ddd = digits.slice(2, 4);
        const rest = digits.slice(4);
        const split = rest.length - 4;
        return `+55 ${ddd} ${rest.slice(0, split)}-${rest.slice(split)}`;
    }
    return `+${digits}`;
}

/** Keeps only digits; returns null when it can't be a phone number. */
export function normalizePhone(input: string | null | undefined): string | null {
    const digits = (input || "").replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return digits;
}

export function phoneToJid(phone: string): string {
    return `${phone}@s.whatsapp.net`;
}

/**
 * Display names come from the customer (WhatsApp profile name) or from the AI: no control characters or
 * line breaks (they could pose as instructions inside the AI prompt), single spaces, bounded length.
 */
export function cleanName(name: string | null | undefined, max = 60): string | null {
    const cleaned = (name ?? "").replace(/[\p{C}\u2028\u2029]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
    return cleaned || null;
}

/** Removes accents and lowercases, for matching what customers type. */
export function normalizeText(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
