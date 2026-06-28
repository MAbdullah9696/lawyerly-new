import type { Request, Response } from "express";
import * as svc from "./consultations.service.js";

const uid = (req: Request) => req.auth!.userId;

export async function createRequest(req: Request, res: Response) {
  res.status(201).json(await svc.createRequest(uid(req), req.body.lawyerId, req.body.caseType, req.body.description));
}
export async function myRequests(req: Request, res: Response) {
  res.json({ requests: await svc.listMyRequests(uid(req)) });
}
export async function cancelRequest(req: Request, res: Response) {
  res.json(await svc.cancelRequest(uid(req), req.params.id));
}
export async function list(req: Request, res: Response) {
  const tab = (req.query as { tab: "active" | "pending" | "closed" }).tab;
  res.json(await svc.listConsultations(uid(req), tab));
}
export async function header(req: Request, res: Response) {
  res.json(await svc.getConsultationHeader(uid(req), req.params.id));
}
export async function messages(req: Request, res: Response) {
  const page = Number((req.query as { page?: number }).page ?? 1);
  res.json(await svc.getMessages(uid(req), req.params.id, page));
}
export async function sendMessage(req: Request, res: Response) {
  res.status(201).json(await svc.createMessage(req.params.id, uid(req), req.body.text, []));
}
export async function attach(req: Request, res: Response) {
  res.status(201).json(await svc.attachDocument(uid(req), req.params.id, req.body.documentId));
}
export async function close(req: Request, res: Response) {
  res.json(await svc.closeConsultation(uid(req), req.params.id));
}
export async function review(req: Request, res: Response) {
  res.json(await svc.submitReview(uid(req), req.params.id, req.body.rating, req.body.text, req.body.caseType));
}
