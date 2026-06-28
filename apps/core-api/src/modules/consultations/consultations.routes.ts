/** Consultation routes (§8.5/§8.6/§8.8). Mounted at /api/consultations. */
import { Router } from "express";
import * as c from "./consultations.controller.js";
import * as s from "./consultations.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const consultationsRouter = Router();

consultationsRouter.use(requireAuth);

// Requests (citizen) — literal paths declared before /:id
consultationsRouter.post("/request", requireRole("citizen"), validate({ body: s.createRequestSchema }), asyncHandler(c.createRequest));
consultationsRouter.get("/requests", requireRole("citizen"), asyncHandler(c.myRequests));
consultationsRouter.delete("/requests/:id", requireRole("citizen"), validate({ params: s.idParam }), asyncHandler(c.cancelRequest));

// My consultations list (citizen)
consultationsRouter.get("/", requireRole("citizen"), validate({ query: s.listQuery }), asyncHandler(c.list));

// Consultation chat (either participant)
consultationsRouter.get("/:id", validate({ params: s.idParam }), asyncHandler(c.header));
consultationsRouter.get("/:id/messages", validate({ params: s.idParam, query: s.messagesQuery }), asyncHandler(c.messages));
consultationsRouter.post("/:id/messages", validate({ params: s.idParam, body: s.sendMessageSchema }), asyncHandler(c.sendMessage));
consultationsRouter.post("/:id/attachments", requireRole("citizen"), validate({ params: s.idParam, body: s.attachSchema }), asyncHandler(c.attach));
consultationsRouter.post("/:id/close", validate({ params: s.idParam }), asyncHandler(c.close));
consultationsRouter.post("/:id/review", requireRole("citizen"), validate({ params: s.idParam, body: s.reviewSchema }), asyncHandler(c.review));
