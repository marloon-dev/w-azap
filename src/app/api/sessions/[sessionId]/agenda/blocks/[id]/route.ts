import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAgenda, reject, ok, serverError } from "../../shared";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sessionId: string; id: string }> }) {
    const { sessionId, id } = await params;
    try {
        const auth = await authorizeAgenda(request, sessionId);
        if (auth.error) return auth.error;
        const result = await prisma.agendaBlock.deleteMany({ where: { id, sessionId: auth.dbSessionId } });
        if (result.count === 0) return reject(404, "Bloqueio não encontrado");
        return ok("Bloqueio removido");
    } catch (error) {
        return serverError("Delete block", error);
    }
}
