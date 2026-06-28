/**
 * Socket.IO gateway for consultation chat (§8.6 / §10.4).
 * - Auth: JWT access token on handshake (`auth.token`).
 * - Rooms: consultation:{id}.
 * - Events: join_consultation, send_message, typing_start/stop, message_read,
 *   leave_consultation.
 */
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { setIo, roomName } from "./io.js";
import * as svc from "../modules/consultations/consultations.service.js";

export function createSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });
  setIo(io);

  // Handshake authentication with DB session check (H-1 fix).
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const claims = verifyAccessToken(token);
      // Confirm the session still exists (catches logout / account revocation).
      const session = await prisma.session.findUnique({ where: { id: claims.sid } });
      if (!session) return next(new Error("session_revoked"));
      // Reject suspended or banned accounts immediately.
      const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { status: true } });
      if (!user || user.status === "suspended" || user.status === "banned") {
        return next(new Error("session_revoked"));
      }
      socket.data.userId = claims.sub;
      socket.data.role = claims.role;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;

    const onError = (action: string) => (e: unknown) => {
      const message = e instanceof Error ? e.message : "error";
      socket.emit("chat_error", { action, message });
    };

    socket.on("join_consultation", async ({ consultationId }: { consultationId: string }) => {
      try {
        await svc.participant(userId, consultationId); // authorize
        await socket.join(roomName(consultationId));
        await svc.markDelivered(consultationId, userId); // joining party received the other's messages
        socket.emit("joined", { consultationId });
      } catch (e) {
        onError("join")(e);
      }
    });

    socket.on("send_message", async ({ consultationId, text }: { consultationId: string; text: string }) => {
      try {
        await svc.createMessage(consultationId, userId, (text ?? "").toString().slice(0, 5000), []);
      } catch (e) {
        onError("send")(e);
      }
    });

    // Verify participant before broadcasting typing events (H-2 fix).
    socket.on("typing_start", async ({ consultationId }: { consultationId: string }) => {
      try {
        await svc.participant(userId, consultationId);
        socket.to(roomName(consultationId)).emit("typing", { userId, typing: true });
      } catch {
        // silently drop — unauthorized typing events must not reach the other party
      }
    });
    socket.on("typing_stop", async ({ consultationId }: { consultationId: string }) => {
      try {
        await svc.participant(userId, consultationId);
        socket.to(roomName(consultationId)).emit("typing", { userId, typing: false });
      } catch {
        // silently drop
      }
    });

    socket.on("message_read", async ({ consultationId }: { consultationId: string }) => {
      try {
        await svc.participant(userId, consultationId);
        await svc.markRead(consultationId, userId);
      } catch (e) {
        onError("read")(e);
      }
    });

    socket.on("leave_consultation", ({ consultationId }: { consultationId: string }) => {
      socket.leave(roomName(consultationId));
    });
  });

  return io;
}
