import { Server, Socket } from "socket.io";
import { getToken } from "next-auth/jwt";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { canAccessSession, hashApiKey } from "../lib/session-access";

interface SocketUser {
  id: string;
  role: string;
}

/** Origins allowed to open a socket: the app's own public URLs (configurable via SOCKET_ALLOWED_ORIGINS). */
export function allowedSocketOrigins(port: number): string[] {
  const list = [
    process.env.BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    ...(process.env.SOCKET_ALLOWED_ORIGINS || "").split(","),
  ];
  return [...new Set(list.map(o => o?.trim().replace(/\/$/, "")).filter((o): o is string => !!o && !o.includes("${")))];
}

/** Resolve the user from the NextAuth session cookie (browser) or an API key (external clients). */
async function authenticate(socket: Socket): Promise<SocketUser | null> {
  const headers = socket.handshake.headers;

  const apiKey = (socket.handshake.auth?.apiKey as string | undefined) || (headers["x-api-key"] as string | undefined);
  if (apiKey && apiKey.length <= 200) {
    const user = await prisma.user.findUnique({ where: { apiKey: hashApiKey(apiKey) }, select: { id: true, role: true } });
    if (user) return user;
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const req = { headers: { cookie: headers.cookie ?? "" } };
  // Cookie name depends on whether the login happened over https
  const token =
    (await getToken({ req, secret, secureCookie: false })) ||
    (await getToken({ req, secret, secureCookie: true }));
  if (!token?.id) return null;

  // Same revocation rule as the HTTP side: deleted users / bumped sessionVersion are rejected
  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { id: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== ((token.sv as number) ?? 0)) return null;
  return { id: user.id, role: user.role };
}

export function setupSocket(io: Server) {
  // Every connection must be authenticated; rooms are then checked per join.
  io.use(async (socket, next) => {
    try {
      const user = await authenticate(socket);
      if (!user) return next(new Error("Unauthorized"));
      socket.data.user = user;
      next();
    } catch (error) {
      logger.error("Socket", "Auth error:", error);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    logger.info("Socket", "Client connected:", socket.id);

    socket.on("disconnect", () => {
      logger.info("Socket", "Client disconnected:", socket.id);
    });

    // Session rooms carry QR codes, pairing codes and live messages: only users with access may join
    socket.on("join-session", async (sessionId: string) => {
      if (typeof sessionId !== "string" || sessionId.length > 100) return;
      try {
        if (await canAccessSession(user.id, user.role, sessionId)) {
          socket.join(sessionId);
          logger.debug("Socket", `Socket ${socket.id} joined session room: ${sessionId}`);
        } else {
          logger.warn("Socket", `Socket ${socket.id} denied access to session room: ${sessionId}`);
        }
      } catch (error) {
        logger.error("Socket", "join-session error:", error);
      }
    });

    // Notification rooms: a user may only join their own
    socket.on("join-user-room", (userId: string) => {
      if (userId !== user.id) {
        logger.warn("Socket", `Socket ${socket.id} tried to join another user's room`);
        return;
      }
      socket.join(`user:${userId}`);
      logger.debug("Socket", `Socket ${socket.id} joined user room: user:${userId}`);
    });
  });
}
