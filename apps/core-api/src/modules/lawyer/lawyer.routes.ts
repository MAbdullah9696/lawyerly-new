/** Lawyer portal routes (§10). Mounted at /api/lawyer. Lawyer-only. */
import { Router } from "express";
import * as c from "./lawyer.controller.js";
import * as s from "./lawyer.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const lawyerRouter = Router();

lawyerRouter.use(requireAuth, requireRole("lawyer"));

// Dashboard
lawyerRouter.get("/dashboard", asyncHandler(c.dashboard));

// Requests
lawyerRouter.get("/requests", validate({ query: s.requestsQuery }), asyncHandler(c.requests));
lawyerRouter.post("/requests/:id/accept", validate({ params: s.idParam }), asyncHandler(c.accept));
lawyerRouter.post("/requests/:id/decline", validate({ params: s.idParam, body: s.declineSchema }), asyncHandler(c.decline));

// Cases & consultations
lawyerRouter.get("/cases", validate({ query: s.casesQuery }), asyncHandler(c.cases));
lawyerRouter.get("/consultations/:id", validate({ params: s.idParam }), asyncHandler(c.consultation));
lawyerRouter.patch("/consultations/:id/notes", validate({ params: s.idParam, body: s.caseNotesSchema }), asyncHandler(c.saveNotes));
lawyerRouter.post("/consultations/:id/close", validate({ params: s.idParam }), asyncHandler(c.closeCase));

// Earnings & payouts
lawyerRouter.get("/earnings", asyncHandler(c.earnings));
lawyerRouter.post("/payouts/methods", validate({ body: s.payoutMethodSchema }), asyncHandler(c.addMethod));
lawyerRouter.post("/payouts/request", asyncHandler(c.requestPayout));

// Profile / availability / settings
lawyerRouter.get("/profile", asyncHandler(c.getProfile));
lawyerRouter.patch("/profile", validate({ body: s.updateProfileSchema }), asyncHandler(c.updateProfile));
lawyerRouter.patch("/availability", validate({ body: s.availabilitySchema }), asyncHandler(c.availability));
lawyerRouter.patch("/settings", validate({ body: s.lawyerSettingsSchema }), asyncHandler(c.settings));
