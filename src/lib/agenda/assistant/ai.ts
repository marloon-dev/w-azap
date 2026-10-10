import type { AgendaConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeFetch, UnsafeUrlError, webhooksAllowPrivate } from "@/lib/safe-fetch";
import { findAvailableDays, findSlots } from "../availability";
import { BookingError, bookAppointment, cancelAppointment, describeAppointment, rescheduleAppointment, upcomingForCustomer } from "../booking";
import { decryptAiKey } from "../config";
import { formatDuration, formatPrice } from "../format";
import { addDays, dayMinuteToDate, isValidDay, parseTimeOfDay, shortDayLabel, timeOf, todayIn, weekdayName } from "../time";
import { saveConversation } from "./conversation";
import { handOffToHuman } from "./menu";
import type { Turn } from "./types";

/**
 * AI assistant over any OpenAI-compatible chat completions API (OmniRoute, OpenAI, OpenRouter, Ollama…).
 * The model only talks; every fact (services, free times) and every change (book, cancel) goes through
 * the tools below, which run the same code as the menu. It can't invent a free time or skip the rules.
 */

export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    tool_call_id?: string;
}

const MAX_ROUNDS = 6;
const MAX_HISTORY = 30;
const REQUEST_TIMEOUT_MS = 45_000;

export type AiErrorCode = "private_host" | "connection" | "provider" | "invalid_response";

export class AiError extends Error {
    constructor(message: string, public code: AiErrorCode = "provider") {
        super(message);
    }
}

const tools = [
    {
        name: "list_services",
        description: "Lista os serviços agendáveis com duração, preço e os profissionais que fazem cada um.",
        parameters: { type: "object", properties: {} },
    },
    {
        name: "find_available_times",
        description: "Horários livres de um serviço em uma data. Sem professional_id, considera todos os profissionais. Se a data não tiver horários, retorna as próximas datas com vaga.",
        parameters: {
            type: "object",
            properties: {
                service_id: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" },
                professional_id: { type: "string" },
            },
            required: ["service_id", "date"],
        },
    },
    {
        name: "book_appointment",
        description: "Agenda um horário. Só chame depois que o cliente confirmar serviço, profissional, data e hora.",
        parameters: {
            type: "object",
            properties: {
                service_id: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: "string", description: "HH:MM (24h)" },
                professional_id: { type: "string", description: "Omitir quando o cliente não tem preferência" },
                customer_name: { type: "string", description: "Nome do cliente, se ele informou" },
            },
            required: ["service_id", "date", "time"],
        },
    },
    {
        name: "list_my_appointments",
        description: "Próximos agendamentos ativos deste cliente.",
        parameters: { type: "object", properties: {} },
    },
    {
        name: "cancel_appointment",
        description: "Cancela um agendamento do cliente. Confirme com ele antes.",
        parameters: { type: "object", properties: { appointment_id: { type: "string" } }, required: ["appointment_id"] },
    },
    {
        name: "reschedule_appointment",
        description: "Muda data/hora de um agendamento do cliente (mesmo serviço). Confira antes com find_available_times.",
        parameters: {
            type: "object",
            properties: {
                appointment_id: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: "string", description: "HH:MM (24h)" },
                professional_id: { type: "string" },
            },
            required: ["appointment_id", "date", "time"],
        },
    },
    {
        name: "confirm_presence",
        description: "Marca que o cliente confirmou que vai comparecer.",
        parameters: { type: "object", properties: { appointment_id: { type: "string" } }, required: ["appointment_id"] },
    },
    {
        name: "handoff_to_human",
        description: "Passa a conversa para uma pessoa da equipe (o assistente fica em silêncio nesse chat). Use quando o cliente pedir ou quando o assunto fugir de agendamentos.",
        parameters: { type: "object", properties: { reason: { type: "string" } } },
    },
].map((fn) => ({ type: "function" as const, function: fn }));

function systemPrompt(turn: Turn) {
    const { config, now } = turn;
    const tz = config.timezone;
    const today = todayIn(tz, now);
    const calendar = Array.from({ length: 14 }, (_, i) => {
        const day = addDays(today, i);
        return `${shortDayLabel(day)} = ${day}${i === 0 ? " (hoje)" : i === 1 ? " (amanhã)" : ""}`;
    }).join("; ");

    return [
        `Você é o assistente virtual de agendamentos${config.businessName ? ` de "${config.businessName}"` : ""}, atendendo clientes pelo WhatsApp.`,
        `Agora: ${weekdayName(today)}, ${today} ${timeOf(now, tz)} (fuso ${tz}).`,
        `Calendário: ${calendar}.`,
        turn.customerName ? `Nome do cliente no WhatsApp: ${turn.customerName}.` : "",
        config.businessInfo ? `Informações do estabelecimento:\n${config.businessInfo}` : "",
        "",
        "Regras:",
        "- Responda no idioma do cliente (padrão: português do Brasil), em mensagens curtas e simpáticas, no estilo WhatsApp (*negrito* com um asterisco). No máximo um emoji por mensagem.",
        "- Nunca invente serviços, preços, profissionais ou horários: use sempre as ferramentas. Se a ferramenta não trouxe, você não sabe.",
        "- Para agendar: descubra o serviço, a preferência de profissional e o dia; consulte find_available_times; ofereça poucas opções (até 6 horários); quando o cliente escolher, repita o resumo (serviço, profissional, dia e hora) e peça confirmação. Só então chame book_appointment.",
        "- Antes de cancelar ou remarcar, confirme com o cliente qual agendamento e o que fazer.",
        `- Clientes só podem cancelar ou remarcar com ${config.cancelMinHours} h de antecedência; dentro desse prazo, ofereça falar com uma pessoa (handoff_to_human).`,
        "- Não mostre ids internos ao cliente.",
        "- Fora de agendamentos e das informações acima, diga que não sabe e ofereça falar com uma pessoa.",
        config.aiInstructions?.trim() ? `\nInstruções do estabelecimento:\n${config.aiInstructions.trim()}` : "",
    ].filter((line) => line !== "").join("\n");
}

type ToolResult = Record<string, unknown>;

function startFrom(turn: Turn, date: unknown, time: unknown): Date | null {
    if (typeof date !== "string" || !isValidDay(date) || typeof time !== "string") return null;
    const minute = parseTimeOfDay(time);
    if (minute === null) return null;
    return dayMinuteToDate(date, minute, turn.config.timezone);
}

function bookingFailure(error: unknown): ToolResult {
    if (error instanceof BookingError) return { ok: false, error: error.code, message: error.message };
    throw error;
}

async function runTool(turn: Turn, name: string, args: Record<string, unknown>, effects: { handoff: boolean }): Promise<ToolResult> {
    const { config, dbSessionId } = turn;
    const tz = config.timezone;

    switch (name) {
        case "list_services": {
            const services = await prisma.agendaService.findMany({
                where: { sessionId: dbSessionId, active: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                include: { professionals: { where: { professional: { active: true } }, include: { professional: { select: { id: true, name: true } } } } },
            });
            return {
                services: services
                    .filter((s) => s.professionals.length > 0)
                    .map((s) => ({
                        id: s.id,
                        name: s.name,
                        description: s.description || undefined,
                        duration: formatDuration(s.durationMinutes),
                        price: formatPrice(s.priceCents) ?? "sob consulta",
                        professionals: s.professionals.map((p) => ({ id: p.professional.id, name: p.professional.name })),
                    })),
            };
        }
        case "find_available_times": {
            const serviceId = String(args.service_id || "");
            const professionalId = typeof args.professional_id === "string" && args.professional_id ? args.professional_id : null;
            const date = String(args.date || "");
            if (!isValidDay(date)) return { ok: false, error: "INVALID_DATE", message: "Use o formato YYYY-MM-DD" };
            const slots = await findSlots(dbSessionId, config, { serviceId, professionalId, day: date, now: turn.now, onePerTime: true });
            if (slots.length > 0) {
                return {
                    date,
                    day: shortDayLabel(date),
                    times: slots.slice(0, 30).map((s) => ({ time: timeOf(s.start, tz), professional_id: s.professionalId, professional: s.professionalName })),
                    more: slots.length > 30 ? slots.length - 30 : undefined,
                };
            }
            const next = await findAvailableDays(dbSessionId, config, { serviceId, professionalId, fromDay: addDays(date, 1), limit: 5, now: turn.now });
            return { date, times: [], next_dates_with_availability: next.map((d) => ({ date: d.day, day: shortDayLabel(d.day), free_times: d.count })) };
        }
        case "book_appointment": {
            const startsAt = startFrom(turn, args.date, args.time);
            if (!startsAt) return { ok: false, error: "INVALID_TIME", message: "Data ou hora inválida" };
            try {
                const appointment = await bookAppointment({
                    dbSessionId,
                    rules: config,
                    serviceId: String(args.service_id || ""),
                    professionalId: typeof args.professional_id === "string" && args.professional_id ? args.professional_id : null,
                    startsAt,
                    customerJid: turn.customerJid,
                    customerName: typeof args.customer_name === "string" && args.customer_name.trim() ? args.customer_name : turn.customerName,
                    source: "WHATSAPP",
                    enforceRules: true,
                    now: turn.now,
                });
                return { ok: true, appointment: { id: appointment.id, summary: describeAppointment(appointment, tz, { price: true }) } };
            } catch (error) {
                return bookingFailure(error);
            }
        }
        case "list_my_appointments": {
            const appointments = await upcomingForCustomer(dbSessionId, turn.customerJid, turn.now);
            return {
                appointments: appointments.map((a) => ({ id: a.id, summary: describeAppointment(a, tz), status: a.status === "CONFIRMED" ? "confirmado" : "agendado" })),
            };
        }
        case "cancel_appointment": {
            try {
                const appointment = await cancelAppointment({ dbSessionId, rules: config, appointmentId: String(args.appointment_id || ""), by: "customer", customerJid: turn.customerJid, now: turn.now });
                return { ok: true, cancelled: describeAppointment(appointment, tz) };
            } catch (error) {
                return bookingFailure(error);
            }
        }
        case "reschedule_appointment": {
            const startsAt = startFrom(turn, args.date, args.time);
            if (!startsAt) return { ok: false, error: "INVALID_TIME", message: "Data ou hora inválida" };
            try {
                const appointment = await rescheduleAppointment({
                    dbSessionId,
                    rules: config,
                    appointmentId: String(args.appointment_id || ""),
                    startsAt,
                    professionalId: typeof args.professional_id === "string" && args.professional_id ? args.professional_id : null,
                    by: "customer",
                    customerJid: turn.customerJid,
                    now: turn.now,
                });
                return { ok: true, appointment: { id: appointment.id, summary: describeAppointment(appointment, tz) } };
            } catch (error) {
                return bookingFailure(error);
            }
        }
        case "confirm_presence": {
            const result = await prisma.agendaAppointment.updateMany({
                where: { id: String(args.appointment_id || ""), sessionId: dbSessionId, customerJid: turn.customerJid, status: "BOOKED" },
                data: { status: "CONFIRMED" },
            });
            return { ok: result.count > 0 };
        }
        case "handoff_to_human": {
            effects.handoff = true;
            return { ok: true, message: "Uma pessoa da equipe vai continuar a conversa. Avise o cliente." };
        }
        default:
            return { ok: false, error: "UNKNOWN_TOOL" };
    }
}

/** Private addresses (e.g. OmniRoute on localhost) are allowed for the instance admin or when the operator opts in. */
export async function aiAllowsPrivate(dbSessionId: string): Promise<boolean> {
    if (webhooksAllowPrivate()) return true;
    const session = await prisma.session.findUnique({ where: { id: dbSessionId }, select: { user: { select: { role: true } } } });
    return session?.user.role === "SUPERADMIN";
}

export async function chatCompletion(
    settings: { baseUrl: string; apiKey: string | null; model: string; allowPrivate: boolean },
    messages: ChatMessage[],
    withTools = true,
): Promise<ChatMessage> {
    const url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    let res: Response;
    try {
        res = await safeFetch(url, {
            method: "POST",
            timeoutMs: REQUEST_TIMEOUT_MS,
            allowPrivate: settings.allowPrivate,
            headers: { "Content-Type": "application/json", ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
            body: JSON.stringify({
                model: settings.model,
                messages,
                ...(withTools ? { tools, tool_choice: "auto" } : {}),
                temperature: 0.3,
                max_tokens: 700,
            }),
        });
    } catch (error) {
        if (error instanceof UnsafeUrlError && /private|reserved/.test(error.message)) {
            throw new AiError("O endereço da IA aponta para a rede interna (ex.: localhost), que só o administrador do sistema pode usar", "private_host");
        }
        const reason = error instanceof Error ? (error.name === "TimeoutError" ? "tempo esgotado" : error.message) : String(error);
        throw new AiError(`Não foi possível conectar à IA: ${reason}`, "connection");
    }
    const body = await res.text();
    if (!res.ok) {
        let detail = body.slice(0, 300);
        try {
            const parsed = JSON.parse(body);
            detail = parsed?.error?.message || parsed?.message || detail;
        } catch { /* not JSON */ }
        throw new AiError(`HTTP ${res.status}: ${detail}`);
    }
    let message: ChatMessage | undefined;
    try {
        message = JSON.parse(body)?.choices?.[0]?.message;
    } catch { /* handled below */ }
    if (!message) throw new AiError("Resposta inesperada do provedor de IA", "invalid_response");
    return { role: "assistant", content: message.content ?? null, ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}) };
}

/** Keeps the tail of the history, starting at a customer message so tool calls stay paired with their results. */
function trimHistory(history: ChatMessage[]): ChatMessage[] {
    if (history.length <= MAX_HISTORY) return history;
    const tail = history.slice(-MAX_HISTORY);
    const firstUser = tail.findIndex((m) => m.role === "user");
    return firstUser >= 0 ? tail.slice(firstUser) : [];
}

export async function settingsFor(config: AgendaConfig) {
    if (!config.aiBaseUrl || !config.aiModel) throw new AiError("IA não configurada");
    return { baseUrl: config.aiBaseUrl, apiKey: decryptAiKey(config), model: config.aiModel, allowPrivate: await aiAllowsPrivate(config.sessionId) };
}

/** Answers one customer message with the AI. Throws AiError when the provider fails (the caller falls back to the menu). */
export async function handleWithAi(turn: Turn): Promise<void> {
    const settings = await settingsFor(turn.config);
    const history: ChatMessage[] = [...turn.conversation.history, { role: "user", content: turn.text.slice(0, 2000) }];
    const effects = { handoff: false };

    let answer: string | null = null;
    for (let round = 0; round < MAX_ROUNDS; round++) {
        const message = await chatCompletion(settings, [{ role: "system", content: systemPrompt(turn) }, ...history]);
        history.push(message);
        if (!message.tool_calls?.length) {
            answer = message.content?.trim() || null;
            break;
        }
        for (const call of message.tool_calls) {
            let args: Record<string, unknown> = {};
            try {
                args = JSON.parse(call.function.arguments || "{}");
            } catch { /* empty args */ }
            const result = await runTool(turn, call.function.name, args, effects);
            history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
    }
    if (!answer) throw new AiError("A IA não produziu uma resposta", "invalid_response");

    turn.conversation.history = trimHistory(history);
    await saveConversation(turn.dbSessionId, turn.customerJid, { history: turn.conversation.history }, turn.now);
    await turn.reply(answer);
    if (effects.handoff) await handOffToHuman(turn);
}

/** Settings page check: one plain request, no tools. */
export async function testAi(settings: { baseUrl: string; apiKey: string | null; model: string; allowPrivate: boolean }) {
    const started = Date.now();
    const message = await chatCompletion(settings, [{ role: "user", content: "Responda apenas com a palavra: ok" }], false);
    return { reply: (message.content || "").trim().slice(0, 200), ms: Date.now() - started };
}

