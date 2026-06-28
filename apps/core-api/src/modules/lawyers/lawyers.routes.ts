/** Lawyer marketplace routes (§8.3 / §8.4). Mounted at /api/lawyers. Citizen-only. */
import { Router } from "express";
import * as c from "./lawyers.controller.js";
import * as s from "./lawyers.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const lawyersRouter = Router();

lawyersRouter.use(requireAuth, requireRole("citizen"));

lawyersRouter.get("/", validate({ query: s.listLawyersQuery }), asyncHandler(c.list));
lawyersRouter.get("/:id", validate({ params: s.lawyerIdParam, query: s.reviewsQuery }), asyncHandler(c.getOne));
