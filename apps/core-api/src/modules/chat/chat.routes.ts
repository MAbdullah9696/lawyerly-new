/** AI chatbot routes (§8.2). Mounted at /api/chat. Citizen-only. */
import { Router } from "express";
import * as c from "./chat.controller.js";
import * as s from "./chat.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const chatRouter = Router();

chatRouter.use(requireAuth, requireRole("citizen"));

chatRouter.post("/message", validate({ body: s.sendMessageSchema }), asyncHandler(c.sendMessage));
chatRouter.get("/sessions", asyncHandler(c.listSessions));
chatRouter.get("/sessions/:id/messages", validate({ params: s.sessionIdParam }), asyncHandler(c.getMessages));
chatRouter.patch(
  "/messages/:id/feedback",
  validate({ params: s.messageIdParam, body: s.feedbackSchema }),
  asyncHandler(c.setFeedback),
);
