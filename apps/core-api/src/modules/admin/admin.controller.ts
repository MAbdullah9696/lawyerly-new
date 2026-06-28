import type { Request, Response } from "express";
import * as svc from "./admin.service.js";
import * as authSvc from "./adminAuth.service.js";

const reqIp = (req: Request) => (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || "0.0.0.0";
const adminUser = (req: Request) => req.admin!.username;

// ---- Auth ----
export async function login(req: Request, res: Response) {
  res.json(await authSvc.adminLogin(req.body.username, req.body.password, reqIp(req)));
}
export async function verify2fa(req: Request, res: Response) {
  res.json(await authSvc.adminVerify2fa(req.body.twoFactorToken, req.body.code, reqIp(req)));
}
export async function logout(req: Request, res: Response) {
  res.json(await authSvc.adminLogout(req.admin!.sessionId, req.admin!.username));
}
export async function me(req: Request, res: Response) {
  res.json(await authSvc.adminMe(req.admin!.id));
}

// ---- Dashboard ----
export async function dashboard(_req: Request, res: Response) {
  res.json(await svc.getDashboard());
}

// ---- Verifications ----
export async function verifications(req: Request, res: Response) {
  res.json(await svc.listVerifications((req.query as { tab: string }).tab));
}
export async function verification(req: Request, res: Response) {
  res.json(await svc.getVerification(req.params.id));
}
export async function approve(req: Request, res: Response) {
  res.json(await svc.approveVerification(adminUser(req), req.params.id));
}
export async function reject(req: Request, res: Response) {
  res.json(await svc.rejectVerification(adminUser(req), req.params.id, req.body.reason, req.body.allowResubmission));
}
export async function verifyDoc(req: Request, res: Response) {
  res.json(await svc.updateVerificationDocument(adminUser(req), req.params.id, req.params.docId, req.body.status, req.body.issueNote));
}

// ---- Users ----
export async function users(req: Request, res: Response) {
  res.json(await svc.listUsers(req.query as never));
}
export async function userDetail(req: Request, res: Response) {
  res.json(await svc.getUserDetail(req.params.id));
}
export async function suspend(req: Request, res: Response) {
  res.json(await svc.suspendUser(adminUser(req), req.params.id, req.body.days, req.body.reason));
}
export async function ban(req: Request, res: Response) {
  res.json(await svc.banUser(adminUser(req), req.params.id, req.body.confirmEmail));
}
export async function lift(req: Request, res: Response) {
  res.json(await svc.liftSuspension(adminUser(req), req.params.id));
}
export async function resetPassword(req: Request, res: Response) {
  res.json(await svc.adminResetPassword(adminUser(req), req.params.id));
}

// ---- Reports ----
export async function reports(req: Request, res: Response) {
  res.json(await svc.listReports(req.query as never));
}
export async function report(req: Request, res: Response) {
  res.json(await svc.getReport(req.params.id));
}
export async function resolveReport(req: Request, res: Response) {
  res.json(await svc.resolveReport(adminUser(req), req.params.id, req.body.action, req.body.resolutionNote, { reviewId: req.body.reviewId, days: req.body.days }));
}

// ---- Reviews ----
export async function reviews(req: Request, res: Response) {
  res.json(await svc.listReviews(req.query as never));
}
export async function approveFlag(req: Request, res: Response) {
  res.json(await svc.approveFlaggedReview(adminUser(req), req.params.id));
}
export async function removeReview(req: Request, res: Response) {
  res.json(await svc.removeReview(adminUser(req), req.params.id, req.body.reason));
}

// ---- Analytics / audit / settings / accounts ----
export async function analytics(req: Request, res: Response) {
  const q = req.query as { from?: string; to?: string };
  res.json(await svc.getAnalytics(q.from, q.to));
}
export async function auditLog(req: Request, res: Response) {
  res.json(await svc.getAuditLog(req.query as never));
}
export async function settings(_req: Request, res: Response) {
  res.json(await svc.getSettings());
}
export async function updateSettings(req: Request, res: Response) {
  res.json(await svc.updateSettings(adminUser(req), req.body));
}
export async function createAccount(req: Request, res: Response) {
  res.status(201).json(await svc.createAdminAccount(adminUser(req), req.body.username, req.body.password, req.body.role));
}
export async function updateAccount(req: Request, res: Response) {
  res.json(await svc.updateAdminAccount(adminUser(req), req.admin!.id, req.params.id, req.body));
}
