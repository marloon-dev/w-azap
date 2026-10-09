import { loadEnvConfig } from "@next/env";
// Load environment variables before any other imports/logic
loadEnvConfig(process.cwd());

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { setupSocket, allowedSocketOrigins } from "./socket";
import { hit } from "../lib/rate-limit";
import { maxUploadBytes } from "../lib/safe-fetch";
import { createHash } from "crypto";
import { waManager } from "../modules/whatsapp/manager";
import { logger } from "../lib/logger";
import pkg from "../../package.json";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3030", 10);
// Listen only on this machine by default. Set BIND_HOST=0.0.0.0 to expose on the network
// (Docker, or behind a reverse proxy on another host).
const bindHost = process.env.BIND_HOST || "127.0.0.1";

// API rate limiting (ENABLE_RATE_LIMITING / RATE_LIMIT_PER_MINUTE). API-key and anonymous callers get
// RATE_LIMIT_PER_MINUTE; logged-in browser sessions get a higher ceiling because the dashboard polls.
const rateLimitEnabled = process.env.ENABLE_RATE_LIMITING !== "false";
const apiPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE) || 60;
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?authjs\.session-token=/;

if (!process.env.AUTH_SECRET) {
  logger.error("Server", "AUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
  process.exit(1);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      if (!req.url) return;

      // Client IP for rate limiting; never trust a value sent by the client
      req.headers["x-wazap-remote-addr"] = req.socket.remoteAddress || "unknown";

      // Reject oversized bodies before they are buffered (MAX_UPLOAD_SIZE_MB)
      const declaredLength = Number(req.headers["content-length"] || 0);
      if (declaredLength > maxUploadBytes()) {
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: false, message: "Payload too large", error: "Payload too large" }));
        req.resume();
        return;
      }

      if (rateLimitEnabled && req.url.startsWith("/api/") && !req.url.startsWith("/api/socket/io")) {
        const apiKey = req.headers["x-api-key"];
        const hasSession = SESSION_COOKIE.test(req.headers.cookie || "");
        const who = typeof apiKey === "string" && apiKey
          ? `key:${createHash("sha256").update(apiKey).digest("hex")}`
          : `ip:${req.headers["x-wazap-remote-addr"]}:${hasSession ? "session" : "anon"}`;
        const limit = hasSession && !apiKey ? apiPerMinute * 10 : apiPerMinute;
        const result = hit(`api:${who}`, limit, 60_000);
        res.setHeader("X-RateLimit-Limit", String(limit));
        res.setHeader("X-RateLimit-Remaining", String(result.remaining));
        if (!result.allowed) {
          res.statusCode = 429;
          res.setHeader("Retry-After", String(result.retryAfterSeconds));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ status: false, message: "Too many requests", error: "Too many requests" }));
          return;
        }
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error("Server", "Error handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(server, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    // Only the app's own origins; also checked for WebSocket upgrades, which CORS does not cover
    cors: {
      origin: allowedSocketOrigins(port),
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Upgrades for other paths (Next.js HMR in dev) are handed to Next below, not destroyed
    destroyUpgrade: false,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin?.replace(/\/$/, "");
      // Non-browser clients (API key integrations) send no Origin header
      callback(null, !origin || allowedSocketOrigins(port).includes(origin));
    },
  });

  // WebSocket upgrades that are not Socket.IO belong to Next.js (dev HMR)
  const nextUpgrade = app.getUpgradeHandler();
  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/socket/io")) {
      nextUpgrade(req, socket, head);
    }
  });

  setupSocket(io);
  // Optional: Global instance for Baileys to emit events
  (global as any).io = io;

  // Initialize WhatsApp Manager
  waManager.setup(io);
  waManager.loadSessions();

  // Start Scheduler
  import("../modules/whatsapp/scheduler").then(m => m.startScheduler());

  // Cloudflare 520 Fix: increase keep-alive timeout so Node doesn't kill idle connections that Cloudflare expects to reuse
  // See: https://github.com/vercel/next.js/issues/48962
  server.keepAliveTimeout = 120 * 1000; // 120 seconds
  server.headersTimeout = 120 * 1000; // 120 seconds

  server.listen(port, bindHost, () => {
    logger.banner(pkg.name.toUpperCase(), pkg.version, port);
  });
});
