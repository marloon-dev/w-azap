import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateApiKey, hashApiKey } from "@/lib/api-auth";

// The key itself is never stored or returned again after creation; only a short hint is.
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { apiKey: true, apiKeyHint: true }
        });

        return NextResponse.json({
            status: true,
            message: "API key fetched",
            data: { hasKey: !!user?.apiKey, hint: user?.apiKey ? (user.apiKeyHint || "wag_") : null }
        });
    } catch (error) {
        return NextResponse.json({ status: false, message: "Failed to fetch API key", error: "Failed to fetch API key" }, { status: 500 });
    }
}

// Generate new API key — returned in full only in this response
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });

    try {
        const newApiKey = generateApiKey();

        await prisma.user.update({
            where: { id: session.user.id },
            data: { apiKey: hashApiKey(newApiKey), apiKeyHint: newApiKey.slice(0, 8) }
        });

        return NextResponse.json({ status: true, message: "API key generated", data: { apiKey: newApiKey, hint: newApiKey.slice(0, 8) } });
    } catch (error) {
        console.error("Generate API key error:", error);
        return NextResponse.json({ status: false, message: "Failed to generate API key", error: "Failed to generate API key" }, { status: 500 });
    }
}

// Delete/revoke API key
export async function DELETE() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { apiKey: null, apiKeyHint: null }
        });

        return NextResponse.json({ status: true, message: "API key revoked" });
    } catch (error) {
        return NextResponse.json({ status: false, message: "Failed to revoke API key", error: "Failed to revoke API key" }, { status: 500 });
    }
}
