import type { NextAuthConfig } from "next-auth";

// SESSION_TIMEOUT_HOURS controls how long a login stays valid (default 24h)
const sessionHours = Number(process.env.SESSION_TIMEOUT_HOURS) || 24;

export const authConfig = {
    pages: {
        signIn: '/auth/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            // API docs and Swagger UI describe every endpoint: require a real login
            const isProtected = nextUrl.pathname.startsWith('/dashboard')
                || nextUrl.pathname.startsWith('/swagger')
                || nextUrl.pathname.startsWith('/docs');

            if (isProtected) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn && nextUrl.pathname === '/auth/login') {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.sv = (user as any).sessionVersion ?? 0;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role;
            }
            return session;
        }
    },
    providers: [], // Configured in auth.ts
    session: {
        strategy: 'jwt',
        maxAge: sessionHours * 60 * 60,
    },
    trustHost: true,
} satisfies NextAuthConfig;
