import { z } from "zod";

export const createGroupSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
    subject: z.string().min(1, "Group subject is required").max(100, "Subject too long"),
    participants: z.array(z.string().regex(/@s\.whatsapp\.net$/, "Invalid participant JID")).min(1, "At least one participant required")
});

