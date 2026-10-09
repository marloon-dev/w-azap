import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { clientIp, hit, peek, reset, LOGIN_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// Compared against when the e-mail does not exist, so response time does not reveal valid accounts
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", 10);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Runs on every auth() call in the Node runtime: re-validate the user against the database so
    // deleted users, changed roles and changed passwords take effect immediately.
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (!token?.id) return token;
      const user = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, sessionVersion: true },
      });
      if (!user || user.sessionVersion !== ((token.sv as number) ?? 0)) {
        return null; // invalidates the session
      }
      token.role = user.role;
      return token;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(1).max(200) })
          .safeParse(credentials);
        if (!parsedCredentials.success) return null;

        const email = parsedCredentials.data.email.toLowerCase().trim();
        const { password } = parsedCredentials.data;
        const ip = clientIp(request.headers);
        const accountKey = `login:acct:${email}`;
        const ipKey = `login:ip:${ip}`;

        // Brute-force protection: refuse before touching bcrypt once a limit is reached
        if (!peek(accountKey, LOGIN_LIMITS.perAccount.limit).allowed || !peek(ipKey, LOGIN_LIMITS.perIp.limit).allowed) {
          logger.warn("Auth", `Login blocked by rate limit for ${email} from ${ip}`);
          throw new RateLimitedSignin();
        }

        const user = await prisma.user.findFirst({ where: { email: { equals: email } } });
        const passwordsMatch = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

        if (user && passwordsMatch) {
          reset(accountKey);
          return user;
        }

        hit(accountKey, LOGIN_LIMITS.perAccount.limit, LOGIN_LIMITS.perAccount.windowMs);
        hit(ipKey, LOGIN_LIMITS.perIp.limit, LOGIN_LIMITS.perIp.windowMs);
        return null;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
});
