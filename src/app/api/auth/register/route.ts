import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { clientIp, hit } from "@/lib/rate-limit";

const registerSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(200),
    password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
    try {
        // Limit account creation attempts per IP
        if (!hit(`register:ip:${clientIp(req.headers)}`, 10, 60 * 60_000).allowed) {
            return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
        }

        const body = await req.json();
        const { password, name } = registerSchema.parse(body);
        const email = registerSchema.shape.email.parse(body.email).toLowerCase().trim();

        // Registration is closed unless an administrator explicitly enabled it.
        // Exception: the very first account can always be created (fresh install).
        const [systemConfig, userCount] = await Promise.all([
            prisma.systemConfig.findUnique({ where: { id: "default" } }),
            prisma.user.count(),
        ]);
        if (userCount > 0 && systemConfig?.enableRegistration !== true) {
            return NextResponse.json(
                { error: "Registration is currently disabled by the administrator" },
                { status: 403 }
            );
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            // Same wording as other failures: do not confirm which e-mails have accounts
            return NextResponse.json(
                { error: "Could not create an account with these details" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                // First account on a fresh install becomes the administrator
                ...(userCount === 0 && { role: "SUPERADMIN" as const }),
            },
        });

        return NextResponse.json({
            success: true,
            message: "User registered successfully",
            user: { id: newUser.id, name: newUser.name, email: newUser.email },
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Could not create an account with these details" },
                { status: 400 }
            );
        }

        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "Internal server error during registration" },
            { status: 500 }
        );
    }
}
