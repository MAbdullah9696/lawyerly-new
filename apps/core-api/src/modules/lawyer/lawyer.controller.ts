import type { Request, Response } from "express";
import * as svc from "./lawyer.service.js";

const uid = (req: Request) => req.auth!.userId;

export async function dashboard(req: Request, res: Response) {
  res.json(await svc.getDashboard(uid(req)));
}
export async function requests(req: Request, res: Response) {
  const tab = (req.query as { tab: "pending" | "declined" | "expired" }).tab;
  res.json({ requests: await svc.listRequests(uid(req), tab) });
}
export async function accept(req: Request, res: Response) {
  res.json(await svc.acceptRequest(uid(req), req.params.id));
}
export async function decline(req: Request, res: Response) {
  res.json(await svc.declineRequest(uid(req), req.params.id, req.body.reason, req.body.message));
}
export async function cases(req: Request, res: Response) {
  const tab = (req.query as { tab: "active" | "closed" }).tab;
  res.json({ cases: await svc.listCases(uid(req), tab) });
}
export async function consultation(req: Request, res: Response) {
  res.json(await svc.getConsultation(uid(req), req.params.id));
}
export async function saveNotes(req: Request, res: Response) {
  res.json(await svc.saveCaseNotes(uid(req), req.params.id, req.body.caseNotes));
}
export async function closeCase(req: Request, res: Response) {
  res.json(await svc.closeConsultation(uid(req), req.params.id));
}
export async function earnings(req: Request, res: Response) {
  res.json(await svc.getEarnings(uid(req)));
}
export async function addMethod(req: Request, res: Response) {
  res.status(201).json(await svc.addPayoutMethod(uid(req), req.body.type, req.body.details, req.body.isDefault));
}
export async function requestPayout(req: Request, res: Response) {
  res.status(201).json(await svc.requestPayout(uid(req)));
}
export async function getProfile(req: Request, res: Response) {
  res.json({ profile: await svc.getOwnProfile(uid(req)) });
}
export async function updateProfile(req: Request, res: Response) {
  res.json({ message: "Profile updated.", profile: await svc.updateOwnProfile(uid(req), req.body) });
}
export async function availability(req: Request, res: Response) {
  res.json(await svc.setAvailability(uid(req), req.body.availability));
}
export async function settings(req: Request, res: Response) {
  res.json(await svc.updateSettings(uid(req), req.body));
}
