import type { Request, Response } from "express";
import * as svc from "./chat.service.js";

export async function sendMessage(req: Request, res: Response) {
  const out = await svc.sendMessage(req.auth!.userId, req.body.message, req.body.sessionId);
  res.status(201).json(out);
}

export async function listSessions(req: Request, res: Response) {
  const sessions = await svc.listSessions(req.auth!.userId);
  res.json({ sessions });
}

export async function getMessages(req: Request, res: Response) {
  const out = await svc.getMessages(req.auth!.userId, req.params.id);
  res.json(out);
}

export async function setFeedback(req: Request, res: Response) {
  await svc.setFeedback(req.auth!.userId, req.params.id, req.body.feedback);
  res.json({ message: "Feedback recorded." });
}
