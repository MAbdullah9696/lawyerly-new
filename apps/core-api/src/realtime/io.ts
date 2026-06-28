/**
 * Holds the Socket.IO server instance + room helpers. Kept separate so both the
 * socket gateway and REST controllers can emit without a circular import.
 */
import type { Server } from "socket.io";

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}
export function getIo(): Server | null {
  return io;
}

export const roomName = (consultationId: string) => `consultation:${consultationId}`;

/** Is a given user currently joined to a consultation's room? (presence → delivered) */
export async function isUserInRoom(consultationId: string, userId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(roomName(consultationId)).fetchSockets();
  return sockets.some((s) => s.data.userId === userId);
}

export function emitToRoom(consultationId: string, event: string, payload: unknown) {
  io?.to(roomName(consultationId)).emit(event, payload);
}
