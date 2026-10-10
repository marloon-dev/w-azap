import { prisma } from "@/lib/prisma";
import { findAvailableDays, findSlots } from "../availability";
import { BookingError, bookAppointment, cancelAppointment, countActiveForCustomer, describeAppointment, rescheduleAppointment, upcomingForCustomer } from "../booking";
import { formatDuration, formatPrice, normalizeText } from "../format";
import { addDays, dayOf, parseCustomerDay, parseTimeOfDay, relativeDayLabel, timeOf, todayIn, whenLabel } from "../time";
import { saveConversation } from "./conversation";
import type { Turn } from "./types";

/**
 * Numbered-menu assistant. Works without any AI and is the fallback when the AI is off or failing.
 * Every option list shown to the customer is kept in the state, so "2" always means what they saw.
 */

interface Option {
    id: string;
    label: string;
}

interface Flow {
    serviceId: string;
    serviceName: string;
    /** null = no preference (first free professional) */
    professionalId: string | null;
    professionalName: string | null;
    /** Set when moving an existing appointment instead of creating one */
    rescheduleId?: string;
}

interface SlotOption {
    start: string;
    professionalId: string;
    professionalName: string;
}

export type MenuState =
    | { step: "main" }
    | { step: "service"; options: Option[] }
    | { step: "professional"; serviceId: string; serviceName: string; options: Option[] }
    | { step: "day"; flow: Flow; days: Option[]; nextFrom: string | null }
    | { step: "slot"; flow: Flow; day: string; slots: SlotOption[]; page: number }
    | { step: "confirm"; flow: Flow; day: string; slot: SlotOption }
    | { step: "mine"; options: Option[] }
    | { step: "manage"; appointmentId: string; label: string }
    | { step: "cancel"; appointmentId: string; label: string }
    | { step: "reminder"; appointmentId: string };

const ANY = "any";
const DAYS_PER_PAGE = 7;
const SLOTS_PER_PAGE = 12;

const YES = ["sim", "s", "confirmo", "confirmar", "ok", "isso", "pode", "pode ser", "certo", "beleza", "claro"];
const NO = ["nao", "n", "não", "negativo"];

function numbered(options: { label: string }[], start = 1) {
    return options.map((option, index) => `*${index + start}.* ${option.label}`).join("\n");
}

/** "2", "2.", "opção 2" → 2 */
function pickNumber(text: string): number | null {
    const match = /^\s*(?:op[cç][aã]o\s*)?(\d{1,2})\s*[.)-]?\s*$/i.exec(text);
    return match ? Number(match[1]) : null;
}

/** The option whose number or (unambiguous) name the customer typed. */
function pickOption<T extends { label: string }>(text: string, options: T[]): T | null {
    const number = pickNumber(text);
    if (number !== null) return options[number - 1] ?? null;
    const typed = normalizeText(text);
    if (typed.length < 3) return null;
    // "barba" is the service Barba, not "Corte + barba": exact name, then prefix, then anywhere in the text
    const name = (o: T) => normalizeText(o.label).split(" — ")[0];
    const tiers = [
        options.filter((o) => name(o) === typed),
        options.filter((o) => name(o).startsWith(typed)),
        options.filter((o) => name(o).includes(typed) || typed.includes(name(o))),
    ];
    const tier = tiers.find((list) => list.length > 0);
    return tier && tier.length === 1 ? tier[0] : null;
}

const isYes = (text: string) => YES.includes(normalizeText(text)) || pickNumber(text) === 1;
const isNo = (text: string) => NO.includes(normalizeText(text));

function firstName(name: string | null) {
    return name?.trim().split(/\s+/)[0] || "";
}

async function setState(turn: Turn, state: MenuState | null) {
    turn.conversation.state = state;
    await saveConversation(turn.dbSessionId, turn.customerJid, { state }, turn.now);
}

/** Pause the assistant in this chat so a person can take over. */
export async function handOffToHuman(turn: Turn) {
    const hours = Math.max(turn.config.humanPauseHours, 1);
    const pausedUntil = new Date(turn.now.getTime() + hours * 3_600_000);
    turn.conversation.pausedUntil = pausedUntil;
    turn.conversation.state = null;
    await saveConversation(turn.dbSessionId, turn.customerJid, { state: null, pausedUntil }, turn.now);
}

// ── Screens ──────────────────────────────────────────────────────────────

async function showMain(turn: Turn, { greet = false, prefix = "" } = {}) {
    const name = firstName(turn.customerName);
    const business = turn.config.businessName.trim();
    const lines: string[] = [];
    if (prefix) lines.push(prefix, "");
    if (greet) {
        lines.push(`Olá${name ? `, ${name}` : ""}! 👋 Sou o assistente virtual${business ? ` de *${business}*` : ""}.`, "");
    }
    const options = ["Agendar um horário", "Meus agendamentos (ver, remarcar ou cancelar)"];
    if (turn.config.businessInfo?.trim()) options.push("Informações");
    lines.push("Como posso ajudar? Responda com o número:", numbered(options.map((label) => ({ label }))), "*9.* Falar com uma pessoa");
    await setState(turn, { step: "main" });
    await turn.reply(lines.join("\n"));
}

async function bookableServices(dbSessionId: string) {
    return prisma.agendaService.findMany({
        where: {
            sessionId: dbSessionId,
            active: true,
            professionals: { some: { professional: { active: true, hours: { some: {} } } } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, durationMinutes: true, priceCents: true },
    });
}

function serviceLabel(service: { name: string; durationMinutes: number; priceCents: number | null }) {
    const price = formatPrice(service.priceCents);
    return `${service.name} — ${formatDuration(service.durationMinutes)}${price ? ` · ${price}` : ""}`;
}

async function showServices(turn: Turn) {
    const limit = turn.config.maxActivePerCustomer;
    if (limit && (await countActiveForCustomer(turn.dbSessionId, turn.customerJid, turn.now)) >= limit) {
        await setState(turn, { step: "main" });
        await turn.reply(`Você já tem ${limit === 1 ? "um agendamento ativo" : `${limit} agendamentos ativos`}. Para marcar outro, cancele ou remarque um deles.\n\n*2.* Meus agendamentos\n*0.* Voltar ao menu`);
        return;
    }
    const services = await bookableServices(turn.dbSessionId);
    if (services.length === 0) {
        await setState(turn, { step: "main" });
        await turn.reply("No momento não há horários disponíveis para agendar por aqui. 😕\nResponda *9* para falar com uma pessoa.");
        return;
    }
    if (services.length === 1) {
        await chooseService(turn, services[0].id, services[0].name);
        return;
    }
    const options = services.map((s) => ({ id: s.id, label: serviceLabel(s) }));
    await setState(turn, { step: "service", options });
    await turn.reply(["Qual serviço você quer agendar?", numbered(options), "", "*0.* Voltar ao menu"].join("\n"));
}

async function chooseService(turn: Turn, serviceId: string, serviceName: string) {
    const professionals = await prisma.agendaProfessional.findMany({
        where: { sessionId: turn.dbSessionId, active: true, services: { some: { serviceId } }, hours: { some: {} } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
    });
    if (professionals.length <= 1) {
        const only = professionals[0];
        await showDays(turn, { serviceId, serviceName, professionalId: only?.id ?? null, professionalName: only?.name ?? null });
        return;
    }
    const options = [...professionals.map((p) => ({ id: p.id, label: p.name })), { id: ANY, label: "Sem preferência (primeiro horário livre)" }];
    await setState(turn, { step: "professional", serviceId, serviceName, options });
    await turn.reply([`*${serviceName}* ✂️\nCom quem você prefere?`, numbered(options), "", "*0.* Voltar ao menu"].join("\n"));
}

async function showDays(turn: Turn, flow: Flow, fromDay?: string, prefix = "") {
    const days = await findAvailableDays(turn.dbSessionId, turn.config, {
        serviceId: flow.serviceId,
        professionalId: flow.professionalId,
        fromDay,
        limit: DAYS_PER_PAGE + 1,
        now: turn.now,
        excludeAppointmentId: flow.rescheduleId,
    });
    if (days.length === 0) {
        await setState(turn, { step: "main" });
        await turn.reply(
            `${prefix}${fromDay ? "Não encontrei mais datas com horário livre." : `Não há horários livres nos próximos ${turn.config.maxAdvanceDays} dias${flow.professionalName ? ` com ${flow.professionalName}` : ""}. 😕`}\n\nResponda *1* para recomeçar ou *9* para falar com uma pessoa.`,
        );
        return;
    }
    const today = todayIn(turn.config.timezone, turn.now);
    const page = days.slice(0, DAYS_PER_PAGE);
    const options = page.map((d) => ({ id: d.day, label: relativeDayLabel(d.day, today) }));
    const nextFrom = days.length > DAYS_PER_PAGE ? addDays(page[page.length - 1].day, 1) : null;
    await setState(turn, { step: "day", flow, days: options, nextFrom });

    const who = flow.professionalName ? ` com ${flow.professionalName}` : "";
    const lines = [`${prefix}Para qual dia${who}?`, numbered(options)];
    if (nextFrom) lines.push(`*${options.length + 1}.* Ver mais datas`);
    lines.push("", "Ou digite uma data (ex.: 25/10).", "*0.* Voltar ao menu");
    await turn.reply(lines.join("\n"));
}

async function showSlots(turn: Turn, flow: Flow, day: string, page = 0, prefix = "") {
    const found = await findSlots(turn.dbSessionId, turn.config, {
        serviceId: flow.serviceId,
        professionalId: flow.professionalId,
        day,
        now: turn.now,
        onePerTime: true,
        excludeAppointmentId: flow.rescheduleId,
    });
    const today = todayIn(turn.config.timezone, turn.now);
    if (found.length === 0) {
        await showDays(turn, flow, undefined, `${prefix}Não há horários livres em ${relativeDayLabel(day, today)}. Escolha outro dia:\n\n`);
        return;
    }
    const slots = found.map((s) => ({ start: s.start.toISOString(), professionalId: s.professionalId, professionalName: s.professionalName }));
    const pageCount = Math.ceil(slots.length / SLOTS_PER_PAGE);
    const current = Math.min(page, pageCount - 1);
    await setState(turn, { step: "slot", flow, day, slots, page: current });

    const visible = slots.slice(current * SLOTS_PER_PAGE, (current + 1) * SLOTS_PER_PAGE);
    const showWho = !flow.professionalId;
    const lines = [
        `${prefix}Horários livres em *${relativeDayLabel(day, today)}*:`,
        numbered(visible.map((s) => ({ label: `${timeOf(new Date(s.start), turn.config.timezone)}${showWho ? ` (${s.professionalName})` : ""}` }))),
    ];
    let next = visible.length + 1;
    if (current < pageCount - 1) lines.push(`*${next++}.* Ver mais horários`);
    lines.push(`*${next}.* Escolher outro dia`, "", "*0.* Voltar ao menu");
    await turn.reply(lines.join("\n"));
}

async function showConfirm(turn: Turn, flow: Flow, day: string, slot: SlotOption) {
    const service = await prisma.agendaService.findUnique({ where: { id: flow.serviceId }, select: { name: true, durationMinutes: true, priceCents: true } });
    const price = formatPrice(service?.priceCents);
    await setState(turn, { step: "confirm", flow, day, slot });
    const lines = [
        flow.rescheduleId ? "Confira a remarcação:" : "Confira seu agendamento:",
        `✂️ *Serviço:* ${flow.serviceName}${service ? ` (${formatDuration(service.durationMinutes)})` : ""}${price ? ` — ${price}` : ""}`,
        `👤 *Profissional:* ${slot.professionalName}`,
        `📅 *Quando:* ${whenLabel(new Date(slot.start), turn.config.timezone)}`,
        "",
        `*1.* ${flow.rescheduleId ? "Confirmar remarcação" : "Confirmar"}`,
        "*2.* Escolher outro horário",
        "*0.* Voltar ao menu",
    ];
    await turn.reply(lines.join("\n"));
}

async function confirmBooking(turn: Turn, state: Extract<MenuState, { step: "confirm" }>) {
    const { flow, slot, day } = state;
    try {
        const appointment = flow.rescheduleId
            ? await rescheduleAppointment({
                dbSessionId: turn.dbSessionId,
                rules: turn.config,
                appointmentId: flow.rescheduleId,
                startsAt: new Date(slot.start),
                professionalId: slot.professionalId,
                by: "customer",
                customerJid: turn.customerJid,
                now: turn.now,
            })
            : await bookAppointment({
                dbSessionId: turn.dbSessionId,
                rules: turn.config,
                serviceId: flow.serviceId,
                professionalId: flow.professionalId ?? slot.professionalId,
                startsAt: new Date(slot.start),
                customerJid: turn.customerJid,
                customerName: turn.customerName,
                source: "WHATSAPP",
                enforceRules: true,
                now: turn.now,
            });
        await setState(turn, null);
        const name = firstName(turn.customerName);
        await turn.reply(
            [
                `✅ ${flow.rescheduleId ? "Remarcado" : "Agendado"}${name ? `, ${name}` : ""}!`,
                describeAppointment(appointment, turn.config.timezone, { price: true }),
                "",
                turn.config.reminderEnabled ? "Vou te mandar um lembrete antes do horário. " : "",
                "Para ver, remarcar ou cancelar, é só mandar *menu*.",
            ].join("\n").replace(/\n\n\n/g, "\n\n"),
        );
    } catch (error) {
        if (error instanceof BookingError && error.code === "SLOT_TAKEN") {
            await showSlots(turn, flow, day, 0, "Ops, esse horário acabou de ser ocupado. 😕\n");
            return;
        }
        if (error instanceof BookingError) {
            await showMain(turn, { prefix: `Não foi possível concluir: ${error.message}.` });
            return;
        }
        throw error;
    }
}

async function showMine(turn: Turn) {
    const appointments = await upcomingForCustomer(turn.dbSessionId, turn.customerJid, turn.now);
    if (appointments.length === 0) {
        await setState(turn, { step: "main" });
        await turn.reply("Você não tem agendamentos futuros.\n\n*1.* Agendar um horário\n*0.* Voltar ao menu");
        return;
    }
    const options = appointments.map((a) => ({ id: a.id, label: describeAppointment(a, turn.config.timezone) }));
    await setState(turn, { step: "mine", options });
    await turn.reply(["Seus próximos agendamentos:", numbered(options), "", "Responda com o número para remarcar ou cancelar.", "*0.* Voltar ao menu"].join("\n"));
}

async function showManage(turn: Turn, option: Option) {
    await setState(turn, { step: "manage", appointmentId: option.id, label: option.label });
    await turn.reply([`📅 ${option.label}`, "", "*1.* Remarcar", "*2.* Cancelar", "*0.* Voltar ao menu"].join("\n"));
}

function tooLateMessage(turn: Turn) {
    return `Faltam menos de ${turn.config.cancelMinHours} h para esse horário, então não consigo alterar por aqui. Responda *9* para falar com uma pessoa.`;
}

async function startReschedule(turn: Turn, appointmentId: string) {
    const appointment = await prisma.agendaAppointment.findFirst({
        where: { id: appointmentId, sessionId: turn.dbSessionId, customerJid: turn.customerJid, status: { in: ["BOOKED", "CONFIRMED"] } },
        include: { service: true, professional: true },
    });
    if (!appointment) return showMine(turn);
    if (appointment.startsAt.getTime() - turn.now.getTime() < turn.config.cancelMinHours * 3_600_000) {
        await setState(turn, { step: "main" });
        await turn.reply(tooLateMessage(turn));
        return;
    }
    await showDays(turn, {
        serviceId: appointment.serviceId,
        serviceName: appointment.service.name,
        professionalId: appointment.professionalId,
        professionalName: appointment.professional.name,
        rescheduleId: appointment.id,
    });
}

async function doCancel(turn: Turn, appointmentId: string) {
    try {
        const appointment = await cancelAppointment({
            dbSessionId: turn.dbSessionId,
            rules: turn.config,
            appointmentId,
            by: "customer",
            customerJid: turn.customerJid,
            now: turn.now,
        });
        await setState(turn, null);
        await turn.reply(`Cancelado. ❌\n${describeAppointment(appointment, turn.config.timezone)}\n\nSe quiser marcar outro horário, é só mandar *menu*.`);
    } catch (error) {
        if (error instanceof BookingError) {
            await setState(turn, { step: "main" });
            await turn.reply(error.code === "TOO_LATE" ? tooLateMessage(turn) : `${error.message}.`);
            return;
        }
        throw error;
    }
}

async function showInfo(turn: Turn) {
    await setState(turn, { step: "main" });
    await turn.reply(`${turn.config.businessInfo?.trim()}\n\n*1.* Agendar um horário\n*0.* Voltar ao menu`);
}

async function askHuman(turn: Turn) {
    await handOffToHuman(turn);
    await turn.reply("Certo! Vou chamar alguém da equipe para falar com você. Aguarde um pouquinho. 🙂");
}

// ── Input handling ───────────────────────────────────────────────────────

const wantsBooking = (t: string) => /\b(agend|marc|horari|reserv)/.test(t);
const wantsMine = (t: string) => /\b(meus? agend|cancel|desmarc|remarc|mudar|trocar)/.test(t);
const wantsHuman = (t: string) => /\b(atendente|pessoa|humano|falar com alguem)/.test(t);
const isMenuCommand = (t: string) => ["0", "menu", "inicio", "voltar", "oi", "ola"].includes(t);

/** Reminder answers ("1"/"2", "sim"/"cancelar"). Returns false when the message is about something else. */
export async function handleReminderReply(turn: Turn, appointmentId: string): Promise<boolean> {
    const text = normalizeText(turn.text);
    if (isYes(turn.text)) {
        const appointment = await prisma.agendaAppointment.findFirst({ where: { id: appointmentId, sessionId: turn.dbSessionId, customerJid: turn.customerJid } });
        await setState(turn, null);
        if (appointment && appointment.status === "BOOKED") {
            await prisma.agendaAppointment.update({ where: { id: appointment.id }, data: { status: "CONFIRMED" } });
        }
        await turn.reply(appointment && appointment.status !== "CANCELLED" ? "Presença confirmada! ✅ Até lá." : "Esse agendamento não está mais ativo. Mande *menu* para ver as opções.");
        return true;
    }
    if (pickNumber(turn.text) === 2 || isNo(turn.text) || /\b(cancel|desmarc)/.test(text)) {
        await doCancel(turn, appointmentId);
        return true;
    }
    if (pickNumber(turn.text) === 3 || /\bremarc/.test(text)) {
        await startReschedule(turn, appointmentId);
        return true;
    }
    return false;
}

export async function handleMenu(turn: Turn): Promise<void> {
    const state = turn.conversation.state;
    const text = normalizeText(turn.text);

    if (!state) {
        if (wantsHuman(text)) return askHuman(turn);
        if (wantsMine(text)) return showMine(turn);
        if (wantsBooking(text)) {
            const name = firstName(turn.customerName);
            await turn.reply(`Olá${name ? `, ${name}` : ""}! 👋 Vamos agendar.`);
            return showServices(turn);
        }
        return showMain(turn, { greet: true });
    }

    if (state.step === "reminder") {
        if (await handleReminderReply(turn, state.appointmentId)) return;
        return showMain(turn, { greet: true });
    }

    if (isMenuCommand(text)) return showMain(turn);
    if (text === "9" || wantsHuman(text)) return askHuman(turn);

    const retry = (hint: string) => turn.reply(`Não entendi. 🤔 ${hint}`);

    switch (state.step) {
        case "main": {
            const number = pickNumber(text);
            if (number === 1 || (number === null && wantsBooking(text))) return showServices(turn);
            if (number === 2 || (number === null && wantsMine(text))) return showMine(turn);
            if (number === 3 && turn.config.businessInfo?.trim()) return showInfo(turn);
            return showMain(turn, { prefix: "Não entendi. 🤔" });
        }
        case "service": {
            const option = pickOption(turn.text, state.options);
            if (!option) return retry(`Responda com o número do serviço (1 a ${state.options.length}) ou *0* para voltar.`);
            return chooseService(turn, option.id, option.label.split(" — ")[0]);
        }
        case "professional": {
            const option = pickOption(turn.text, state.options);
            if (!option) return retry(`Responda com um número de 1 a ${state.options.length}.`);
            const any = option.id === ANY;
            return showDays(turn, { serviceId: state.serviceId, serviceName: state.serviceName, professionalId: any ? null : option.id, professionalName: any ? null : option.label });
        }
        case "day": {
            const number = pickNumber(text);
            if (number !== null && state.nextFrom && number === state.days.length + 1) return showDays(turn, state.flow, state.nextFrom);
            const option = number !== null ? state.days[number - 1] : null;
            if (option) return showSlots(turn, state.flow, option.id);
            const typed = parseCustomerDay(turn.text, todayIn(turn.config.timezone, turn.now));
            if (typed) return showSlots(turn, state.flow, typed);
            return retry("Responda com o número do dia ou digite uma data, como 25/10.");
        }
        case "slot": {
            const visible = state.slots.slice(state.page * SLOTS_PER_PAGE, (state.page + 1) * SLOTS_PER_PAGE);
            const hasMore = (state.page + 1) * SLOTS_PER_PAGE < state.slots.length;
            const number = pickNumber(text);
            if (number !== null) {
                if (number >= 1 && number <= visible.length) return showConfirm(turn, state.flow, state.day, visible[number - 1]);
                if (hasMore && number === visible.length + 1) return showSlots(turn, state.flow, state.day, state.page + 1);
                if (number === visible.length + (hasMore ? 2 : 1)) return showDays(turn, state.flow);
            }
            const minute = parseTimeOfDay(turn.text);
            if (minute !== null) {
                const slot = state.slots.find((s) => {
                    const time = timeOf(new Date(s.start), turn.config.timezone);
                    return parseTimeOfDay(time) === minute;
                });
                if (slot) return showConfirm(turn, state.flow, state.day, slot);
                return retry("Esse horário não está livre. Escolha um número da lista.");
            }
            return retry("Responda com o número do horário.");
        }
        case "confirm": {
            if (isYes(turn.text)) return confirmBooking(turn, state);
            if (pickNumber(text) === 2 || isNo(turn.text)) return showSlots(turn, state.flow, state.day);
            return retry("Responda *1* para confirmar ou *2* para escolher outro horário.");
        }
        case "mine": {
            const option = pickOption(turn.text, state.options);
            if (!option) return retry(`Responda com um número de 1 a ${state.options.length}.`);
            return showManage(turn, option);
        }
        case "manage": {
            const number = pickNumber(text);
            if (number === 1 || /\bremarc/.test(text)) return startReschedule(turn, state.appointmentId);
            if (number === 2 || /\bcancel/.test(text)) {
                await setState(turn, { step: "cancel", appointmentId: state.appointmentId, label: state.label });
                return turn.reply(`Tem certeza que quer cancelar?\n${state.label}\n\n*1.* Sim, cancelar\n*2.* Não`);
            }
            return retry("Responda *1* para remarcar ou *2* para cancelar.");
        }
        case "cancel": {
            if (isYes(turn.text)) return doCancel(turn, state.appointmentId);
            return showMain(turn, { prefix: "Tudo certo, o agendamento continua de pé. 👍" });
        }
    }
}

/** Text of the reminder and the state that makes "1"/"2" answer it. */
export function reminderText(appointment: Parameters<typeof describeAppointment>[0], timezone: string, now: Date) {
    const today = todayIn(timezone, now);
    const day = dayOf(appointment.startsAt, timezone);
    const when = day === today ? "hoje" : day === addDays(today, 1) ? "amanhã" : relativeDayLabel(day, today);
    const name = firstName(appointment.customerName);
    return [
        `⏰ Lembrete${name ? `, ${name}` : ""}: você tem *${appointment.service.name}* com ${appointment.professional.name} ${when} às *${timeOf(appointment.startsAt, timezone)}*.`,
        "",
        "*1.* Confirmar presença",
        "*2.* Cancelar",
        "*3.* Remarcar",
    ].join("\n");
}
