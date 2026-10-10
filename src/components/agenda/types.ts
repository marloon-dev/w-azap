/** Shapes returned by /api/sessions/{id}/agenda/* */

export interface AgendaService {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number | null;
    active: boolean;
    sortOrder: number;
    professionalIds: string[];
    appointmentCount: number;
}

export interface WorkingHour {
    weekday: number;
    start: string;
    end: string;
}

export interface AgendaProfessional {
    id: string;
    name: string;
    phone: string | null;
    active: boolean;
    sortOrder: number;
    serviceIds: string[];
    hours: WorkingHour[];
    appointmentCount: number;
}

export type AppointmentStatus = "BOOKED" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface AgendaAppointment {
    id: string;
    professionalId: string;
    serviceId: string;
    customerJid: string;
    customerName: string | null;
    customerPhone: string;
    startsAt: string;
    endsAt: string;
    status: AppointmentStatus;
    source: "WHATSAPP" | "PANEL";
    notes: string | null;
    priceCents: number | null;
    service: { id: string; name: string; durationMinutes: number };
    professional: { id: string; name: string };
}

export interface AgendaBlock {
    id: string;
    professionalId: string | null;
    startsAt: string;
    endsAt: string;
    reason: string | null;
    professional: { id: string; name: string } | null;
}

export interface AgendaSlot {
    start: string;
    time: string;
    professionalId: string;
    professionalName: string;
}

export interface AgendaSettings {
    configured: boolean;
    canEdit: boolean;
    enabled: boolean;
    businessName: string;
    businessInfo: string;
    timezone: string;
    slotStep: number;
    minAdvanceMinutes: number;
    maxAdvanceDays: number;
    cancelMinHours: number;
    triggerMode: "ALL" | "KEYWORD";
    triggerKeyword: string;
    humanPauseHours: number;
    reminderEnabled: boolean;
    reminderHours: number;
    notifyProfessional: boolean;
    aiEnabled: boolean;
    aiBaseUrl: string;
    aiApiKey: string;
    aiModel: string;
    aiInstructions: string;
    aiLastError: string | null;
    aiLastErrorAt: string | null;
}
